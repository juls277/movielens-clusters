let currentMovie = null;
let movieOpenedAt = null;

function saveHistoryItem(movie, timeSpent){
  const storedHistory = localStorage.getItem("movieHistory");

  //parse into js arr 
  const history = storedHistory ? JSON.parse(storedHistory) : [];

   history.push({
    id: movie.id,
    title: movie.title,
    genres: movie.genres,
    timeSpent: timeSpent
  });

  localStorage.setItem(
    "movieHistory",
    JSON.stringify(history)
  );
}

export function loadUserHistory() {
  const storedHistory =
    localStorage.getItem("movieHistory");

  const history = storedHistory
    ? JSON.parse(storedHistory)
    : [];

  return history;
}

export function saveCurrentMovieView() {
  if (currentMovie === null || movieOpenedAt === null) {
    return;
  }

  const now = Date.now();

  const timeSpent =
    Math.floor((now - movieOpenedAt) / 1000);

  saveHistoryItem(
    currentMovie,
    timeSpent
  );

  currentMovie = null;
  movieOpenedAt = null;
}

export function startMovieView(movie) {
  saveCurrentMovieView();

  currentMovie = movie;
  movieOpenedAt = Date.now();
}