import { LuCheck } from "react-icons/lu";
import { PLAN_COPY } from "@/lib/pricing";

const ROWS: { feature: string; free: string | true; pro: string | true }[] = [
  {
    feature: "Players per room",
    free: String(PLAN_COPY.free.maxPlayers),
    pro: String(PLAN_COPY.pro.maxPlayers),
  },
  {
    feature: "Quizzes",
    free: `Up to ${PLAN_COPY.free.maxQuizzes}`,
    pro: "Unlimited",
  },
  {
    feature: "AI quiz generations",
    free: `${PLAN_COPY.free.aiTokens} total`,
    pro: `${PLAN_COPY.pro.aiTokensPerWeek} per week`,
  },
  { feature: "AI Knowledge Spaces", free: true, pro: true },
  { feature: "Live rooms with code, link & QR join", free: true, pro: true },
  { feature: "Ranked 1v1 duels", free: true, pro: true },
];

function Cell({ value }: { value: string | true }) {
  return value === true ? (
    <LuCheck
      aria-label="Included"
      className="mx-auto text-lprimary dark:text-dprimary"
      size={18}
    />
  ) : (
    <span>{value}</span>
  );
}

export default function PlanComparison() {
  return (
    <section className="mt-20">
      <h2 className="text-2xl font-black text-center text-dark dark:text-white">
        Compare plans
      </h2>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-card-light dark:border-card-dark bg-white dark:bg-card-dark">
        <table className="w-full min-w-[480px] text-sm text-dark dark:text-white">
          <thead>
            <tr className="border-b border-card-light dark:border-dark">
              <th className="text-left font-bold p-4">Feature</th>
              <th className="font-bold p-4 w-32">Free</th>
              <th className="font-bold p-4 w-32 text-lprimary dark:text-dprimary">
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                className="border-b last:border-b-0 border-card-light dark:border-dark"
              >
                <td className="p-4">{row.feature}</td>
                <td className="p-4 text-center">
                  <Cell value={row.free} />
                </td>
                <td className="p-4 text-center font-bold">
                  <Cell value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
