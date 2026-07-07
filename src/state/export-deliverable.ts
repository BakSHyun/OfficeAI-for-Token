export async function copyDeliverableToClipboard(content: string) {
  await navigator.clipboard.writeText(content);
}
