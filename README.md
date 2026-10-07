# The Dugout — mobile app

Native iOS/Android app for The Dugout (FCV Dender), built with Expo / React Native.
It uses the same Supabase project as the web app (`football-hub`), so both show the same data.

## Run it

```bash
npm install
npx expo start
```

Press `i` for the iOS simulator, or scan the QR code with the Expo Go app on your phone.

## Where things live

- `src/app/` — screens (Expo Router): `login`, and the tabs Dashboard, Games, Trainings, Squad, Profile
- `src/lib/supabase.ts` — Supabase client (same project and username login as the web app)
- `src/lib/data.tsx` — loads players, games and trainings; read-only for now
- `src/lib/theme.ts` — colours and fonts, mirrored from the web app
