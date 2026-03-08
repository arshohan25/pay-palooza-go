import { useState, useCallback, useMemo } from "react";

export function usePhoneValidation(phone: string) {
  const [shaking, setShaking] = useState(false);
  const [touched, setTouched] = useState(false);

  const isValid = phone.length === 11 && phone.startsWith("01");

  const showError = useMemo(() => {
    if (!touched && !shaking) return false;
    if (phone.length === 0) return false;
    if (phone.length > 2 && !phone.startsWith("01")) return true;
    if (touched && phone.length > 0 && phone.length < 11) return true;
    return false;
  }, [phone, touched, shaking]);

  const triggerShake = useCallback(() => {
    setTouched(true);
    if (isValid) return false;
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    return true; // true = was invalid
  }, [isValid]);

  const errorMessage = useMemo(() => {
    if (!showError) return "";
    if (phone.length > 2 && !phone.startsWith("01")) return "Number must start with 01";
    if (phone.length > 0 && phone.length < 11) return "Enter a valid 11-digit number";
    return "";
  }, [showError, phone]);

  const shakeClass = shaking ? "animate-shake" : "";
  const errorBorderClass = showError ? "border-destructive focus-visible:ring-destructive" : "";
  const inputClassName = `${shakeClass} ${errorBorderClass}`.trim();

  return { isValid, showError, triggerShake, shakeClass, errorMessage, inputClassName, setTouched };
}
