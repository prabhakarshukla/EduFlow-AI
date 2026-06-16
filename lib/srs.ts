export function getNextReview(rating: string) {
  const next = new Date();

  switch (rating) {
    case "again":
      next.setMinutes(next.getMinutes() + 10);
      break;

    case "hard":
      next.setDate(next.getDate() + 1);
      break;

    case "good":
      next.setDate(next.getDate() + 3);
      break;

    case "easy":
      next.setDate(next.getDate() + 7);
      break;

    default:
      next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}