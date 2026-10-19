import { FlowEditor } from "@/components/admin/FlowEditor";

export const dynamic = "force-dynamic";

export default function NewFlow() {
  return <FlowEditor flow={null} initial={null} />;
}
