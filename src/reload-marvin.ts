import { browser } from "wxt/browser";

export async function reloadMarvinTabs(): Promise<number> {
  const tabs = await browser.tabs.query({ url: "https://app.amazingmarvin.com/*" });
  await Promise.all(tabs.flatMap((tab) => (tab.id == null ? [] : [browser.tabs.reload(tab.id)])));
  return tabs.length;
}
