const fs = require("fs");
const csv = require("csv-parser");

const allowedGenres = new Set([
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Foreign",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western"
]);

function parseGenres(genresString) {
  if (!genresString) {
    return [];
  }

  try {
    const jsonString = genresString.replace(/'/g, '"');
    const genres = JSON.parse(jsonString);

    return genres
      .map((genre) => genre.name)
      .filter((name) => name);

  } catch (error) {
    return [];
  }
}

function parseOptionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value.trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}



function loadCleanMovies() {

  return new Promise((resolve, reject) => {

    const movies = [];

    fs.createReadStream("data/raw/movies_metadata.csv")

      .on("error", (error) => {
        reject(error);
      })

      .pipe(csv())

      .on("data", (row) => {

        
        const genres = parseGenres(row.genres);

        // only valid
        const validGenres = genres.filter((genre) =>
          allowedGenres.has(genre)
        );

        // no valid genre -> skip movie
        if (validGenres.length === 0) {
          return;
        }

        // parse ID
        const id = Number(row.id);

        if (!Number.isFinite(id)) {
          return;
        }

        // clean title
        const title = row.title?.trim();

        if (!title) {
          return;
        }

        // create clean movie object
        const movie = {
          id: id,
          title: title,
          genres: validGenres,
          overview: row.overview?.trim() || "",
          releaseDate: row.release_date?.trim() || "",
          runtime: parseOptionalNumber(row.runtime)
        };

        movies.push(movie);
      })

      .on("end", () => {

        //remove dupes

        const uniqueMoviesMap = new Map();

        for (const movie of movies) {

          if (!uniqueMoviesMap.has(movie.id)) {
            uniqueMoviesMap.set(movie.id, movie);
          }

        }

        const uniqueMovies = [
          ...uniqueMoviesMap.values()
        ];

        // Give the cleaned dataset back
        resolve(uniqueMovies);
      });

  });
}


//export

module.exports = {
  loadCleanMovies
};


//if preprocessing is executed directly

if (require.main === module) {

  loadCleanMovies()
    .then((movies) => {

      console.log("Preprocessing finished");

      console.log(
        "Final clean movies:",
        movies.length
      );

      const genres = new Set(
        movies.flatMap((movie) => movie.genres)
      );

      console.log(
        "Number of genres:",
        genres.size
      );

      console.log(
        "Genres:",
        [...genres].sort()
      );

      console.log(
        "\nFirst 5 movies:"
      );

      console.log(
        movies.slice(0, 5)
      );

    })

    .catch((error) => {
      console.error(
        "Preprocessing failed:",
        error
      );
    });
}