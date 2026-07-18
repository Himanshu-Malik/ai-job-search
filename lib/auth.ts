import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { supabaseAdmin } from '@/lib/supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    // Runs on every sign-in. Create the profile row if it doesn't exist.
    async signIn({ user }) {
      if (!user.email) return false

      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.email)
        .maybeSingle()

      if (!existing) {
        await supabaseAdmin.from('user_profiles').insert({
          user_id: user.email,      // using email as stable ID
          email: user.email,
          name: user.name,
          avatar_url: user.image,
          onboarding_complete: false,
          skills: [],
        })
      }

      return true
    },

    // Put the user's email + onboarding status into the JWT
    async jwt({ token, user }) {
      if (user?.email) token.userId = user.email

      if (token.userId) {
        const { data } = await supabaseAdmin
          .from('user_profiles')
          .select('onboarding_complete')
          .eq('user_id', token.userId as string)
          .maybeSingle()

        token.onboardingComplete = data?.onboarding_complete ?? false
      }

      return token
    },

    // Expose it on the session object for client components
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.onboardingComplete = token.onboardingComplete as boolean
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/login',
  },
})