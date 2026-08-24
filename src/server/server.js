const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(
  express.static(
    path.join(__dirname, "../client")
  )
);
const PORT = 3000;



app.get("/cluster/single/:genre", (req, res) => {

  const genre = req.params.genre;

  const filePath = path.join(
    process.cwd(),
    "data",
    "processed",
    "single",
    `${genre}.json`
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "Cluster not found"
    });
  }

  const data = fs.readFileSync(
    filePath,
    "utf8"
  );

  const movies = JSON.parse(data);

  res.json(movies);
});




app.get("/cluster/pair/:pair", (req, res) => {

  const pair = req.params.pair;

  const filePath = path.join(
    process.cwd(),
    "data",
    "processed",
    "pairs",
    `${pair}.json`
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "Cluster not found"
    });
  }

  const data = fs.readFileSync(
    filePath,
    "utf8"
  );

  const movies = JSON.parse(data);

  res.json(movies);
});


//server start

app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

});
