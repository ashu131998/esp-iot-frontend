/** Under the factory ID: the address it becomes, what it may contain, and that it is for good. */
export function FactoryIdHint({ id }: { id: string }) {
  return (
    <>
      <p className="text-xs text-muted">
        This becomes the factory&apos;s own address, where its people sign in:{' '}
        <span className="font-mono">{id.trim() || '…'}.floorbeat.in</span>
      </p>
      <p className="text-xs text-muted">
        Only lowercase letters (a–z), digits (0–9) and hyphens (-): no spaces, no &quot;_&quot;, no capital letters.{' '}
        <span className="font-medium text-foreground">It cannot be changed later.</span>
      </p>
    </>
  );
}
