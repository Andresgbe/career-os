import ToBuyBoard from "./components/ToBuyBoard";

export default function ToBuyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">To Buy</h1>
        <p className="text-sm text-muted">
          Shopping lists grouped by category — drag items between columns,
          check them off as you buy them.
        </p>
      </div>

      <ToBuyBoard />
    </div>
  );
}
