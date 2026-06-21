<script>
  import { onMount } from 'svelte';

  const skins = [
    { id: 'quiet', label: 'quiet', title: 'Minimalist — editorial' },
    { id: 'terminal', label: 'term', title: 'Geeky — terminal' },
    { id: 'descent', label: 'ml', title: 'Machine learning — dashboard' },
  ];

  let active = 'quiet';

  onMount(() => {
    const current = document.documentElement.dataset.skin;
    active = skins.some((s) => s.id === current) ? current : 'quiet';
  });

  function pick(id) {
    active = id;
    document.documentElement.dataset.skin = id;
    try {
      localStorage.setItem('skin', id);
    } catch (e) {}
    // let hero scripts (typing / chart) react to the change
    window.dispatchEvent(new CustomEvent('skinchange', { detail: id }));
  }
</script>

<div class="skin-selector" role="group" aria-label="Site theme">
  {#each skins as s}
    <button
      type="button"
      class:active={active === s.id}
      title={s.title}
      aria-pressed={active === s.id}
      on:click={() => pick(s.id)}
    >
      {s.label}
    </button>
  {/each}
</div>

<style>
  .skin-selector {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--bg-soft);
  }

  button {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.3rem 0.7rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
    line-height: 1;
  }

  button:hover {
    color: var(--fg);
  }

  button.active {
    background: var(--accent);
    color: var(--bg);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
