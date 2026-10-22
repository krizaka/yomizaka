import { PlacePage } from "@/components/console/PlacePage";

export default function FolderPage(props: React.ComponentProps<typeof PlacePage>) {
  return <PlacePage params={props.params} searchParams={props.searchParams} />;
}
