const fs = require("fs");

const text = fs.readFileSync( "data/processed/single/Action.json",
  "utf8");

const movies = JSON.parse(text);
console.log(movies.length, movies[0]);

const ids = movies.map((movie)=>movie.id);

console.log(ids.length, ids.slice(0,5));