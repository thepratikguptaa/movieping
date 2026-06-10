// ----------------------------------------------------------------------------
// Firestore data model
// ----------------------------------------------------------------------------

export interface UserPreferences {
  genres: number[]; // TMDB genre ids
  languages: string[]; // ISO 639-1 codes e.g. "en", "hi"
  industries: string[]; // e.g. "Hollywood", "Bollywood"
  favoriteMovies: number[]; // TMDB movie ids
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences: UserPreferences;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

// users/{uid}/watchlist/{movieId}
export interface WatchlistItem {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  released: boolean;
  notify: boolean; // notify me when released
  addedAt: number;
}

// movies/{movieId} — tracked movies for the release checker
export interface TrackedMovie {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  released: boolean;
  lastCheckedAt: number;
  subscriberCount: number;
}

// movies/{movieId}/subscribers/{uid}
export interface MovieSubscriber {
  uid: string;
  subscribedAt: number;
  notified: boolean;
}

// users/{uid}/fcmTokens/{tokenId}
export interface FcmTokenDoc {
  token: string;
  createdAt: number;
  userAgent: string;
}

export type NotificationType = "release" | "system";

// users/{uid}/notifications/{notifId}
export interface NotificationDoc {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  movieId?: number;
  posterPath?: string | null;
  url: string;
  read: boolean;
  createdAt: number;
}

// ----------------------------------------------------------------------------
// TMDB
// ----------------------------------------------------------------------------

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
  original_language: string;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: TMDBGenre[];
  runtime: number | null;
  tagline: string | null;
  status: string;
  credits?: { cast: TMDBCastMember[] };
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
