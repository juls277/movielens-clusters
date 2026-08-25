const MOVIES_PER_PAGE = 50;

let currentMoviePage = 0;

export function displayMovies(
  movies,
  onMovieClick
) {
  currentMoviePage = 0;

  renderMoviePage(
    movies,
    currentMoviePage,
    onMovieClick
  );

   renderPagination(
    movies,
    onMovieClick
  );
}
export function showMovieDetails(movie) {

  

  const details = document.getElementById("movieDetails");

  details.innerHTML = `
  <h3>${movie.title}</h3>
  <p>${movie.genres.join(", ")}</p>
  <p>${movie.overview}</p>
`;




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

export function displayGenreOptions(genres) {
  const container =
    document.getElementById("genresContainer");

  for (const genre of genres) {
    const label =
      document.createElement("label");

    const checkbox =
      document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = genre;

    label.appendChild(checkbox);
    label.append(` ${genre} `);

    container.appendChild(label);
  }
}

function renderMoviePage(movies, page, onMovieClick){
    const container = document.getElementById("moviesContainer");

    container.innerHTML="";

    const start =
    page * MOVIES_PER_PAGE;

    const end =
    start + MOVIES_PER_PAGE;

    const moviesToDisplay = movies.slice(start,end);

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

function renderPagination(
  movies,
  onMovieClick
) {
  const container =
    document.getElementById("paginationContainer");

  container.innerHTML = "";

  const totalPages =
    Math.ceil(
      movies.length / MOVIES_PER_PAGE
    );

  const previousButton =
    document.createElement("button");

  previousButton.textContent = "Previous";

  previousButton.disabled =
    currentMoviePage === 0;

  previousButton.addEventListener("click", () => {
    currentMoviePage--;

    renderMoviePage(
      movies,
      currentMoviePage,
      onMovieClick
    );

    renderPagination(
      movies,
      onMovieClick
    );
  });

  const pageInfo =
    document.createElement("span");

  pageInfo.textContent =
    ` Page ${currentMoviePage + 1} of ${totalPages} `;

  const nextButton =
    document.createElement("button");

  nextButton.textContent = "Next";

  nextButton.disabled =
    currentMoviePage >= totalPages - 1;

  nextButton.addEventListener("click", () => {
    currentMoviePage++;

    renderMoviePage(
      movies,
      currentMoviePage,
      onMovieClick
    );

    renderPagination(
      movies,
      onMovieClick
    );
  });

  container.appendChild(previousButton);
  container.appendChild(pageInfo);
  container.appendChild(nextButton);
}