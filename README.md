# Tafelvoetbal Competitie PWA

Een moderne Progressive Web App voor het bijhouden van kantoor tafelvoetbal competities met ELO rating systeem.

## ✨ Features

### 🏆 Core Functionaliteit
- **ELO Rating Systeem**: Dynamische ratings gebaseerd op wedstrijdresultaten
- **2v2 Team Matches**: Ondersteuning voor team wedstrijden
- **Score-based Rating Changes**: Grotere rating veranderingen bij grotere score verschillen
- **Win Streaks**: Bonus punten voor opeenvolgende overwinningen
- **Crawl Game Detection**: Speciale behandeling voor 10-0 scores

### 📱 Gebruikersinterface
- **3-Tab Navigatie**: 
  - 🏆 **Ranking**: Leaderboard met alle spelers
  - ⚽ **Match**: Nieuwe wedstrijd toevoegen
  - 📊 **More**: Dashboard met alle extra features
- **Dark Glassmorphism Design**: Moderne, donkere interface
- **Mobile-First**: Geoptimaliseerd voor mobiel gebruik
- **PWA Ready**: Installeerbaar als app

### 📊 Dashboard Features
- **Spelers Beheer**: Admin functies voor speler management
- **Wedstrijd Historie**: Overzicht van alle gespeelde wedstrijden
- **Hall of Fame**: All-time records en prestaties
- **Achievements**: Prestatie systeem met badges
- **Maandelijkse Awards**: Player of the month tracking

### 🎯 Geavanceerde Features
- **Individual Player Pages**: Gedetailleerde speler statistieken
- **Head-to-Head Stats**: Onderlinge resultaten tussen spelers
- **Recent Form**: Prestaties van laatste 5 wedstrijden
- **Admin Authentication**: Beveiligde admin functies
- **Tournament Mode**: Toernooi organisatie (toekomstige feature)

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Custom admin system
- **Styling**: Glassmorphism design met Tailwind
- **Icons**: Lucide React
- **PWA**: Next.js PWA support

## 📱 Navigation Structure

### Hoofdnavigatie (3 tabs)
1. **🏆 Ranking** - Leaderboard met compact design
2. **⚽ Match** - Nieuwe wedstrijd toevoegen
3. **📊 More** - Dashboard met alle extra features

### Dashboard Secties
- **Spelers** - Beheer spelers en admin functies
- **Wedstrijd Historie** - Bekijk alle gespeelde wedstrijden  
- **Hall of Fame** - All-time records en prestaties
- **Achievements** - Bekijk alle behaalde prestaties
- **Maandelijkse Awards** - Player of the month en meer

## 🎮 Gebruik

1. **Spelers Toevoegen**: Ga naar More → Spelers → Admin login (wachtwoord: admin123)
2. **Wedstrijd Spelen**: Gebruik de Match tab om nieuwe wedstrijden toe te voegen
3. **Statistieken Bekijken**: Klik op speler namen/foto's voor gedetailleerde stats
4. **Rankings Volgen**: Bekijk real-time ELO ratings in de Ranking tab

## 🏗️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🗄️ Database

Het project gebruikt Supabase met de volgende tabellen:
- `players` - Speler informatie en statistieken
- `matches` - Wedstrijd resultaten
- `achievements` - Prestatie tracking
- `tournaments` - Toernooi data
- `monthly_awards` - Maandelijkse awards

## 🔐 Admin Features

Admin functies zijn beveiligd met wachtwoord authenticatie:
- Spelers toevoegen/bewerken
- Wedstrijden beheren
- Statistieken resetten
- Awards toekennen

**Admin wachtwoord**: `admin123`

## 📈 Rating Systeem

- **Base K-factor**: 32
- **Score Multiplier**: 0.15 (grotere score verschillen = meer rating verandering)
- **Win Streak Bonus**: 30% bonus voor 3+ streak, 60% voor 5+ streak, 90% voor 10+ streak
- **Crawl Game**: 10-0 of 10-1 scores krijgen extra impact
- **Duel Balance**: 1vs1 matches krijgen 0.6x scaling factor om balans te behouden met 2vs2

## 🎨 Design

Het design gebruikt een dark glassmorphism thema met:
- Donkere achtergronden met transparantie
- Subtiele glaseffecten
- Gradient accenten
- Smooth animaties
- Mobile-first responsive design

## 🚀 Quick Start

### 1. Dependencies Installeren
```bash
npm install
```

### 2. Supabase Database Setup
1. Ga naar [Supabase](https://supabase.com) en maak een nieuw project
2. Kopieer de inhoud van `supabase-schema.sql`
3. Ga naar SQL Editor in je Supabase dashboard
4. Plak en voer de SQL uit om tabellen en policies aan te maken

### 3. Environment Setup
De Supabase credentials zijn al geconfigureerd in `lib/supabase.ts`:
- Project URL: `https://pbnyolmnuitftzgegiid.supabase.co`
- Anon Key: Al ingesteld

### 4. Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

## 🏗️ Project Structuur

```
soccer/
├── app/                    # Next.js 14 App Router
│   ├── globals.css        # Global styles met glassmorphism
│   ├── layout.tsx         # Root layout met PWA meta tags
│   └── page.tsx           # Main page met tab navigatie
├── components/            # React componenten
│   ├── Leaderboard.tsx   # Ranking overzicht
│   ├── NewMatch.tsx      # Nieuwe wedstrijd form
│   ├── Players.tsx       # Speler management
│   └── MatchHistory.tsx  # Wedstrijd geschiedenis
├── lib/                  # Utilities en configuratie
│   ├── supabase.ts      # Supabase client
│   └── rating-system.ts # ELO rating berekeningen
├── types/               # TypeScript type definities
│   └── database.ts     # Database interfaces
└── public/             # Static assets
    └── manifest.json   # PWA manifest
```

## 🎯 Rating Systeem

Het rating systeem is gebaseerd op ELO met aanpassingen voor team play:

### Basis Formule
- **K-Factor**: 32 (rating volatiliteit)
- **Score Multiplier**: 0.1 (impact van score verschil)
- **Team Rating**: Som van individuele speler ratings

### Rating Berekening
1. **Expected Score**: Berekend op basis van team rating verschil
2. **Actual Result**: 1 voor winst, 0 voor verlies
3. **Score Impact**: Grotere score verschillen = grotere rating veranderingen
4. **Team Distribution**: Rating verandering wordt gelijk verdeeld over team leden

### Voorbeelden
- **Close Game (10-9)**: Minimale rating verandering (~8-12 punten)
- **Blowout (10-0)**: Drastische rating verandering (~25-35 punten)
- **Upset Win**: Zwakkere team wint = grote rating boost

## 🎨 Design System

### Glassmorphism Theme
- **Background**: Gradient van slate-900 naar slate-800
- **Glass Cards**: Semi-transparante achtergrond met backdrop blur
- **Borders**: Subtiele witte borders met lage opacity
- **Shadows**: Zachte shadows voor diepte

### Color Palette
- **Primary**: Blue-600 naar Purple-600 gradient
- **Success**: Green-400/500
- **Warning**: Yellow-400
- **Error**: Red-400/500
- **Text**: White met verschillende opacity levels

## 📊 Database Schema

### Players Table
```sql
- id (UUID, Primary Key)
- name (VARCHAR, NOT NULL)
- photo_url (TEXT, Optional)
- rating (INTEGER, Default: 1200)
- goals_scored (INTEGER, Default: 0)
- goals_conceded (INTEGER, Default: 0)
- wins (INTEGER, Default: 0)
- losses (INTEGER, Default: 0)
- created_at (TIMESTAMP)
```

### Matches Table
```sql
- id (UUID, Primary Key)
- team1_player1 (UUID, Foreign Key)
- team1_player2 (UUID, Foreign Key)
- team2_player1 (UUID, Foreign Key)
- team2_player2 (UUID, Foreign Key)
- team1_score (INTEGER, 0-10)
- team2_score (INTEGER, 0-10)
- created_at (TIMESTAMP)
```

## 🚀 Deployment naar Netlify

### 1. Build Configuratie
```bash
npm run build
```

### 2. Netlify Setup
1. Connect je GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Node version: 18 of hoger

### 3. Environment Variables
Geen extra environment variables nodig - Supabase credentials zijn al geconfigureerd.

### 4. PWA Features
- Manifest wordt automatisch geserveerd
- Service worker voor offline functionaliteit
- Installeerbaar op alle devices

## 🔧 Aanpassingen & Uitbreidingen

### Rating Systeem Tweaks
Pas `lib/rating-system.ts` aan voor:
- K-Factor aanpassing (meer/minder volatiel)
- Score multiplier (impact van blowouts)
- Minimum/maximum rating grenzen

### Extra Features Toevoegen
Mogelijke uitbreidingen:
- **Tournaments**: Bracket-style toernooien
- **Teams**: Vaste team formaties
- **Achievements**: Badges voor prestaties
- **Analytics**: Grafieken en trends
- **Notifications**: Push notifications voor challenges

### Styling Aanpassingen
- Pas `app/globals.css` aan voor andere kleuren
- Wijzig glassmorphism opacity in Tailwind config
- Voeg custom animaties toe

## 🐛 Troubleshooting

### Database Connectie Issues
1. Check Supabase project status
2. Verify RLS policies zijn correct ingesteld
3. Check browser console voor errors

### Photo Upload Problemen
1. Verify storage bucket 'photos' bestaat
2. Check storage policies
3. Verify file size limits

### PWA Installatie Issues
1. Check manifest.json is toegankelijk
2. Verify HTTPS (required voor PWA)
3. Check browser PWA support

## 📝 License

Dit project is gemaakt voor intern kantoorgebruik. Voel je vrij om het aan te passen voor je eigen behoeften.

---

**Veel plezier met je tafelvoetbal competitie! ⚽🏆** 