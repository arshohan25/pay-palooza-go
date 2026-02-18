import confetti from "canvas-confetti";

export const fireSuccessConfetti = () => {
  // First burst — centered spread
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ["#10b981", "#34d399", "#6ee7b7", "#ffffff", "#a7f3d0"],
    scalar: 1.1,
    gravity: 1.1,
    ticks: 200,
  });

  // Second burst after short delay — sides
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ["#10b981", "#f59e0b", "#ffffff"],
      scalar: 0.9,
      ticks: 180,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ["#10b981", "#f59e0b", "#ffffff"],
      scalar: 0.9,
      ticks: 180,
    });
  }, 150);
};
