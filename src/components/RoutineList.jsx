export default function RoutineList({ items }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-sky-100 pl-6">
      {items.map((r, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[33px] top-0.5 h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow" />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-sm font-semibold text-sky-800">{r.time}</span>
            <span className="font-medium">{r.activity}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
        </li>
      ))}
    </ol>
  )
}
