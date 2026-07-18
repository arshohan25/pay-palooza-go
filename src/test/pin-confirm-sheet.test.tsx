import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PinConfirmSheet from "@/components/PinConfirmSheet";

const verifyPinMock = vi.fn();
vi.mock("@/lib/verifyPin", () => ({
  verifyPin: (pin: string) => verifyPinMock(pin),
}));
vi.mock("@/lib/haptics", () => ({
  haptics: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Contract test for the shared PIN gate used by every money-moving flow:
 * top-ups, transfers, bill payments, float requests, refunds, chargebacks.
 * onConfirmed MUST NOT fire unless verifyPin resolves to true.
 */
describe("PinConfirmSheet – money-moving gate", () => {
  beforeEach(() => verifyPinMock.mockReset());

  const setup = () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <PinConfirmSheet
        open
        onClose={onClose}
        title="Confirm"
        description="desc"
        onConfirmed={onConfirmed}
      />,
    );
    return { onConfirmed, onClose };
  };

  const enterPin = (value: string) => {
    const input = screen.getByPlaceholderText("••••") as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  };

  it("blocks submission when PIN shorter than 4 digits", () => {
    const { onConfirmed } = setup();
    enterPin("12");
    expect(verifyPinMock).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("blocks the money-moving callback when PIN is wrong", async () => {
    verifyPinMock.mockResolvedValue(false);
    const { onConfirmed, onClose } = setup();
    enterPin("9999");
    await waitFor(() => expect(verifyPinMock).toHaveBeenCalledWith("9999"));
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument();
  });

  it("only invokes the money-moving callback after PIN verifies", async () => {
    verifyPinMock.mockResolvedValue(true);
    const { onConfirmed, onClose } = setup();
    enterPin("1234");
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
