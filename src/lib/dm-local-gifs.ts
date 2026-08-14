export type LocalGif = { id: string; title: string; url: string; preview: string; sport: string };

// Curated public sports clips. No API key is required.
export const LOCAL_SPORT_GIFS: LocalGif[] = [
  { id: "football-goal", title: "Gól!", sport: "Fotbal", url: "https://media.giphy.com/media/3o7TKFZl9gqI1YJ5sQ/giphy.gif", preview: "https://media.giphy.com/media/3o7TKFZl9gqI1YJ5sQ/200w.gif" },
  { id: "football-win", title: "Vítězství", sport: "Fotbal", url: "https://media.giphy.com/media/xT8qBepJQzUjW0YQ7C/giphy.gif", preview: "https://media.giphy.com/media/xT8qBepJQzUjW0YQ7C/200w.gif" },
  { id: "basket-win", title: "Basket vítězství", sport: "Basket", url: "https://media.giphy.com/media/3o7TKy7hA6Jq4d2G5W/giphy.gif", preview: "https://media.giphy.com/media/3o7TKy7hA6Jq4d2G5W/200w.gif" },
  { id: "hockey-goal", title: "Hokejový gól", sport: "Hokej", url: "https://media.giphy.com/media/3o6Zt6D5K0mJYw6rL2/giphy.gif", preview: "https://media.giphy.com/media/3o6Zt6D5K0mJYw6rL2/200w.gif" },
  { id: "tennis-win", title: "Game, set, match", sport: "Tenis", url: "https://media.giphy.com/media/3o7TKu6d8g3F3vA9m8/giphy.gif", preview: "https://media.giphy.com/media/3o7TKu6d8g3F3vA9m8/200w.gif" },
];

export const SPORT_GIF_QUERIES = [
  { label: "⚽ Fotbal", query: "football" },
  { label: "🏒 Hokej", query: "hockey" },
  { label: "🏀 Basket", query: "basketball" },
  { label: "🎾 Tenis", query: "tennis" },
  { label: "🏆 Vítězství", query: "sports win" },
];
