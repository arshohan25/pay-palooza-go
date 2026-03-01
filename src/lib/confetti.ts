import confetti from "canvas-confetti";

export const fireSuccessConfetti = () => {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ["#166534", "#22c55e", "#4ade80", "#ffffff", "#d4a017"],
    scalar: 1.1,
    gravity: 1.1,
    ticks: 200,
  });

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ["#166534", "#d4a017", "#ffffff"],
      scalar: 0.9,
      ticks: 180,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ["#166534", "#d4a017", "#ffffff"],
      scalar: 0.9,
      ticks: 180,
    });
  }, 150);
};
