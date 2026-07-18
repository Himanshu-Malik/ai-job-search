import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'

type ResumeParseResult = {
  text?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt'])

const SKILL_KEYWORDS = [
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node.js',
  'python',
  'java',
  'sql',
  'postgresql',
  'mongodb',
  'aws',
  'docker',
  'kubernetes',
  'graphql',
  'tailwind',
]

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_KEYWORDS.filter((skill) => lower.includes(skill)).slice(0, 12)
}

function normalizeSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      return []
    }
  }

  return []
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx === -1) return ''
  return fileName.slice(idx + 1).toLowerCase()
}

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const resume = formData.get('resume')

  if (!(resume instanceof File)) {
    return NextResponse.json({ error: 'Resume file is required.' }, { status: 400 })
  }

  if (resume.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })
  }

  const extension = getExtension(resume.name)
  const isLikelySupported =
    (!!resume.type && ALLOWED_TYPES.has(resume.type)) ||
    ALLOWED_EXTENSIONS.has(extension)

  let extractedText = ''

  try {
    const buffer = Buffer.from(await resume.arrayBuffer())

    if (resume.type === 'application/pdf' || extension === 'pdf') {
      const parsed = await (pdfParse as (dataBuffer: Buffer) => Promise<ResumeParseResult>)(buffer)
      extractedText = parsed.text || ''
    } else if (resume.type === 'text/plain' || extension === 'txt') {
      extractedText = buffer.toString('utf8')
    } else if (!isLikelySupported) {
      console.warn('Resume uploaded with unknown type/extension; using fallback text only', {
        mimeType: resume.type,
        extension,
      })
    }
  } catch (err) {
    console.warn('Resume parsing failed; using fallback text only', err)
  }

  const { data: existingProfile, error: fetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('skills, summary, raw_resume_text')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: 'Could not load profile.' }, { status: 500 })
  }

  const normalizedText = extractedText.replace(/\s+/g, ' ').trim()
  const fallbackText = [
    existingProfile?.raw_resume_text ?? '',
    existingProfile?.summary ?? '',
    `Resume filename: ${resume.name || 'unknown-file'}`,
    'Resume uploaded by user.',
  ].filter(Boolean).join('\n')

  const embeddingInput = normalizedText || fallbackText

  if (!embeddingInput.trim()) {
    return NextResponse.json({ error: 'Could not create profile text for embedding.' }, { status: 400 })
  }

  let resumeEmbedding: number[]

  try {
    resumeEmbedding = await generateEmbedding(embeddingInput)
  } catch {
    return NextResponse.json({ error: 'Failed to generate resume embedding.' }, { status: 500 })
  }

  const detectedSkills = extractSkills(extractedText)
  const existingSkills = normalizeSkills(existingProfile?.skills)

  const mergedSkills = Array.from(new Set([...existingSkills, ...detectedSkills]))

  const updatePayload: {
    onboarding_complete: boolean
    skills?: string[]
    summary?: string
    raw_resume_text?: string
  } = {
    onboarding_complete: true,
  }

  if (mergedSkills.length > 0) {
    updatePayload.skills = mergedSkills
  }

  if (normalizedText) {
    updatePayload.raw_resume_text = normalizedText
  }

  updatePayload.summary = (
    normalizedText ||
    existingProfile?.summary ||
    `Resume uploaded: ${resume.name}`
  ).slice(0, 1800)

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update(updatePayload)
    .eq('user_id', session.user.id)

  if (updateError) {
    console.error('Failed to save core resume profile fields:', updateError)
    return NextResponse.json({ error: 'Failed to save resume details.' }, { status: 500 })
  }

  // Save embedding as a best-effort step so onboarding does not fail
  // when the embedding column/type is not present yet in DB.
  const { error: embeddingUpdateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ resume_embedding: resumeEmbedding })
    .eq('user_id', session.user.id)

  if (embeddingUpdateError) {
    console.warn('Could not persist resume embedding:', embeddingUpdateError)
  }

  return NextResponse.json({
    ok: true,
    extractedSkills: detectedSkills.length,
    embeddingSaved: !embeddingUpdateError,
  })
}
