import { PlacePage } from "@/components/console/PlacePage";

export default function UnfiledPage(props: React.ComponentProps<typeof PlacePage>) {
  return <PlacePage params={props.params} searchParams={props.searchParams} unfiled />;
}
