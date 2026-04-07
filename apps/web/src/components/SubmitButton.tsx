"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

const SubmitButton = (params: {
  text?: string;
  loader?: string;
  style?: string;
  error?: boolean;
  /** When set, overrides react-dom useFormStatus (needed for React Hook Form + mutations). */
  isPending?: boolean;
  /** Optional callback fired on click before form submission. */
  onClick?: () => void;
}) => {
  const { pending } = useFormStatus();
  const isLoading = params.isPending ?? pending;

  return (
    <Button
      type="submit"
      fullWidth
      disabled={params.error}
      onClick={params.onClick}
      isLoading={isLoading}
      loadingText={params.loader || "Loading..."}
      value="submit"
    >
      {params.text || "Next"}
    </Button>
  );
};

export default SubmitButton;
