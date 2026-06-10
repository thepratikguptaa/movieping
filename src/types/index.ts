// ----------------------------------------------------------------------------
// Firestore data model
// ----------------------------------------------------------------------------

/** Movies and web series share most plumbing; this disambiguates them.
 *  A missing value on legacy documents is always treated as "movie". */
export type MediaType = "movie" | "tv";

export interface UserPreferences {
  genres: number[]; // TMDB movie genre ids
  tvGenres?: number[]; // TMDB TV genre ids (distinct list from movie genres)
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

// users/{uid}/watchlist/{docId}  (docId = movieId, or "tv_<id>" for series)
export interface WatchlistItem {
  movieId: number;
  mediaType?: MediaType; // absent ⇒ movie
  title: string;
  posterPath: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  released: boolean;
  notify: boolean; // notify me when released
  addedAt: number;
}

// movies/{docId} — tracked titles for the release / OTT checkers
export interface TrackedMovie {
  movieId: number;
  mediaType?: MediaType; // absent ⇒ movie
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  released: boolean;
  lastCheckedAt: number;
  subscriberCount: number;
  // OTT / streaming availability
  onOtt?: boolean;
  ottProviders?: string[];
  ottRegion?: string;
  ottCheckedAt?: number;
  // TV-only: track new-season availability
  seasonCount?: number; // number of seasons that have aired
  latestSeasonAired?: string | null; // air_date of the most recent aired season
}

// movies/{docId}/subscribers/{uid}
export interface MovieSubscriber {
  uid: string;
  subscribedAt: number;
  notified: boolean; // theatrical/digital release notification sent
  ottNotified?: boolean; // "now streaming" notification sent
  lastSeasonNotified?: number; // TV-only: highest season we've pinged about
}

// users/{uid}/fcmTokens/{tokenId}
export interface FcmTokenDoc {
  token: string;
  createdAt: number;
  userAgent: string;
}

export type NotificationType = "release" | "ott" | "season" | "system";

// users/{uid}/notifications/{notifId}
export interface NotificationDoc {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  movieId?: number;
  mediaType?: MediaType; // absent ⇒ movie
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

// TMDB TV uses `name`/`first_air_date` where movies use `title`/`release_date`.
export interface TMDBTvShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids?: number[];
  original_language: string;
}

export interface TMDBTvSeason {
  season_number: number;
  air_date: string | null;
  episode_count: number;
  name: string;
}

export interface TMDBTvDetails extends TMDBTvShow {
  genres: TMDBGenre[];
  tagline: string | null;
  status: string;
  number_of_seasons: number;
  last_air_date: string | null;
  seasons: TMDBTvSeason[];
  credits?: { cast: TMDBCastMember[] };
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
