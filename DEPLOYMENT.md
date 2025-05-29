# Deployment Guide - Netlify

## 🚀 Deploying Soccer Table App to Netlify

### Prerequisites
- GitHub account
- Netlify account
- Supabase project

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### Step 2: Connect to Netlify
1. Go to [Netlify](https://app.netlify.com)
2. Click "New site from Git"
3. Connect your GitHub account
4. Select your soccer repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`

### Step 3: Set Environment Variables
In Netlify dashboard → Site settings → Environment variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://pbnyolmnuitftzgegiid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibnlvbG1udWl0ZnR6Z2VnaWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDI0MzQsImV4cCI6MjA2NDAxODQzNH0.Kv4wZiEhngN0cSZzgXl1rYJ5PBIsMFYzcOEc22vF5MM
```

### Step 4: Deploy
1. Click "Deploy site"
2. Wait for build to complete
3. Your app will be live at the generated Netlify URL

### Step 5: Custom Domain (Optional)
1. In Netlify dashboard → Domain settings
2. Add custom domain
3. Configure DNS settings

### 🔧 Configuration Files
- `netlify.toml` - Netlify build configuration
- `lib/supabase.ts` - Updated to use environment variables

### 🗄️ Database
Your Supabase database is already configured and will work with the deployed app.

### 🔐 Authentication System
- Admin login: `toni` / `unicornDeveloper`
- Regular users: password `tafelvoetbal`

### 📱 Features Available
- ✅ Full leaderboard with player rankings
- ✅ Match recording system
- ✅ User authentication and profiles
- ✅ Player statistics and analytics
- ✅ Responsive mobile design
- ✅ Real-time data from Supabase

### 🚨 Troubleshooting
If build fails:
1. Check environment variables are set correctly
2. Ensure all dependencies are in package.json
3. Check build logs in Netlify dashboard
4. Verify Supabase connection

### 🔄 Auto-Deploy
Once connected, Netlify will auto-deploy on every push to main branch. 