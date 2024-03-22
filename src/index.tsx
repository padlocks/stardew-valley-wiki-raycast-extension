import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";
import fetch from "node-fetch"
import { NodeHtmlMarkdown } from 'node-html-markdown'

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

async function checkImageStatus(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return { url, status: 'loaded' };
    } else {
      return { url, status: 'failed' };
    }
  } catch (error) {
    return { url, status: 'failed' };
  }
}

async function getItemDetail(title) {
  const base_url = 'https://stardewvalleywiki.com/';
  const response = await fetch(base_url + title);
  let body = await response.text();

  const imageUrls = [String];
  body = body.replace(/<img.*?src="(.*?)".*?>/g, (match, url) => {
    url = url.replace('/mediawiki', base_url + 'mediawiki');
    if (!url.startsWith('http')) {
      if (!url.includes('https://stardewvalleywiki.com')) {
        url = base_url + url;
      }
    }
    imageUrls.push(url);
    return `<img src="${url}" />`;
  });

  const imageLoadingPromises = imageUrls.map(checkImageStatus);
  const imageLoadingResults = await Promise.all(imageLoadingPromises);

  const failedImages = imageLoadingResults.filter((result) => result.status === 'failed');
  failedImages.forEach((failedImage) => console.log(`Failed to load image: ${failedImage.url}`));

  body = body.replace(/data-sort-value="(\d+)"&gt;/g, (match, number) => {
    return ``;
  });

  console.log(body);

  const content = NodeHtmlMarkdown.translate(body);
  console.log(content);
  return content;
}


interface SearchResult {
  name: string;
  url: string;
  detail: string;
}
