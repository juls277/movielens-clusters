export function displayMovies(movies, onMovieClick) {
  const container =
    document.getElementById("moviesContainer");

  container.innerHTML = "";

  const moviesToDisplay =
    movies.slice(0, 50);

  for (const movie of moviesToDisplay) {
    const movieButton =
      document.createElement("button");

    movieButton.textContent =
      movie.title;

    movieButton.addEventListener("click", () => {
      onMovieClick(movie);
    });

    container.appendChild(movieButton);
  }
}

export function showMovieDetails(movie) {

  startMovieView(movie);

  const details = document.getElementById("movieDetails");

  details.innerHTML = `
  <h3>${movie.title}</h3>
  <p>${movie.genres.join(", ")}</p>
  <p>${movie.overview}</p>
`;

//remove later 

console.log(
  "Stored history:",
  loadUserHistory()
);



}

export function displayRecommendations(recommendations) {
  const container =
    document.getElementById("recommendationsContainer");

  container.innerHTML = "";

  for (const recommendation of recommendations) {
    const item =
      document.createElement("div");

    item.innerHTML = `
      <h3>${recommendation.title}</h3>
      <p>${recommendation.genres.join(", ")}</p>
      <p>Score: ${recommendation.score.toFixed(3)}</p>
    `;

    container.appendChild(item);
  }
}

