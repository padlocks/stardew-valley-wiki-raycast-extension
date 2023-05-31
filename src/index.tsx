import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";
import fetch from "node-fetch"

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const { data, isLoading } = useFetch(
    "https://stardewvalleywiki.com/mediawiki/api.php?action=opensearch&format=json&formatversion=2&namespace=0&limit=5&" +
      // send the search query to the API
      new URLSearchParams({ search: searchText.length === 0 ? "calendar" : searchText }),
    {
      parseResponse: parseFetchResponse,
    }
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Stardew Valley Wiki..."
      throttle
      isShowingDetail
    >
      <List.Section title="Results" subtitle={data?.length + ""}>
        {data?.map((searchResult: SearchResult) => (
          <SearchListItem key={searchResult.name} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.name}
      // subtitle={searchResult.description}
      detail={
        <List.Item.Detail markdown={searchResult.detail} />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={searchResult.url} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

/** Parse the response from the fetch query into something we can display */
async function parseFetchResponse(response: Response) {
  
  const json = await response.json() 
  console.log(json)
  if (!response.ok || "message" in json) {
    throw new Error("message" in json ? json.message : response.statusText);
  }

  const titles = json[1]
  const number_of_results = titles.length 
  const urls = json[3]
  const result = Promise.all(
    titles.map(async (title: any, index: string | number) => ({
      name: title,
      url: urls[index],
      detail: await getItemDetail(title)
    } as SearchResult))
  );

  
  return result
}

async function getItemDetail(title:string) {
  // https://stardewcommunitywiki.com/mediawiki/api.php?action=parse&page=Weather
  // https://stardewcommunitywiki.com/mediawiki/api.php?action=query&prop=revisions&titles=Coffee%20Bean&rvslots=*&rvprop=content&formatversion=2
  const base_url = 'https://stardewcommunitywiki.com/mediawiki/api.php?action=query&prop=revisions&rvprop=content&formatversion=2&format=json&titles=';
  const response = await fetch(base_url + title);
  const body = await response.json();

  const content  = body.query.pages[0].revisions[0].content;
  console.log(body.query.pages[0].revisions[0].content);
  return content;
}

interface SearchResult {
  name: string;
  url: string;
  detail: string;
}
