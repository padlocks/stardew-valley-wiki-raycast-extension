import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const { data, isLoading } = useFetch(
    "https://stardewvalleywiki.com/mediawiki/api.php?action=opensearch&format=json&formatversion=2&namespace=0&limit=10&" +
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
        <List.Item.Detail markdown="![Illustration](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png)" />
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
  const result = titles.map((title: any, index: string | number) => ({
    name: title,
    url: urls[index],
  } as SearchResult));

  
  return result
}

interface SearchResult {
  name: string;
  url: string;
}
