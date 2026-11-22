"use client";

import type { MouseEvent } from "react";

type RemoveProductButtonProps = {
  id: number;
  name: string;
  action: (formData: FormData) => Promise<void>;
};

export default function RemoveProductButton({ id, name, action }: RemoveProductButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(`Remove "${name}"? (Hatayein?)`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={handleClick}
        className="h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-colors duration-200 hover:bg-red-50"
      >
        Remove (Hatayein)
      </button>
    </form>
  );
}
