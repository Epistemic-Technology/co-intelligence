import { createSignal } from "solid-js";

export default function HelloWorld() {
  const [count, setCount] = createSignal(0);
  return (
    <div class="p-4 max-w-sm">
      <h1 class="text-xl font-bold mb-2">👋 Hello from Solid!</h1>
      <button
        class="px-3 py-1 border rounded hover:bg-gray-200"
        onClick={() => setCount(c => c + 1)}
      >
        Clicked {count()}
      </button>
    </div>
  );
}
