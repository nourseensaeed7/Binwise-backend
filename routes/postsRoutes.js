import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json([
    { id: 1, title: "First Post" },
    { id: 2, title: "Second Post" },
  ]);
});

export default router;


