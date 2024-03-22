import { ActionPanel, Action, List, Cache } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";
import fetch from "node-fetch";
import { NodeHtmlMarkdown } from 'node-html-markdown';

const markdownCache = new Cache();

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
        {data?.map((searchResult) => (
          <SearchListItem key={searchResult.name} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }) {
  return (
    <List.Item
      title={searchResult.name}
      subtitle={searchResult.description}
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

async function parseFetchResponse(response) {
  const json = await response.json();
  if (!response.ok || "message" in json) {
    throw new Error("message" in json ? json.message : response.statusText);
  }

  const titles = json[1];
  const urls = json[3];
  const result = Promise.all(
    titles.map(async (title, index) => ({
      name: title,
      url: urls[index],
      detail: await getItemDetail(title)
    }))
  );

  return result;
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
  const cachedContent = markdownCache.get(title);
  if (cachedContent) {
    console.log("Retrieving Markdown content from cache for:", title);
    return cachedContent;
  }

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

  body = body.replace(/data-sort-value="(\d+)"\s*/g, '');
  body = body.replace(/<table[^>]*>/g, '<table>').replace(/<\/tr>\s*<tr[^>]*>/g, '</tr><tr>').replace(/<\/td>\s*<td[^>]*>/g, '</td><td>').replace(/<\/table>\s*<table[^>]*>/g, '</table><table>').replace(/<\/table><table><\/table>/g, '');

  // console.log(body);

  const content = nhm.translate(body);
  // markdownCache.set(title, content);

  return content;
};

const nhm = new NodeHtmlMarkdown({
  /* options (optional) */
}, {
  /* customTransformers (optional) */
  'table': ({ visitor }) => ({
    surroundingNewlines: 2,
    childTranslators: visitor.instance.tableTranslators,
    postprocess: ({ content, nodeMetadata, node }) => {
        const rawRows = splitSpecial(content).map(({ text }) => text.trim().replace(/^\||\|$/g, ''));
        const rows: string[][] = [];
        const colWidth: number[] = [];
        for (const row of rawRows) {
            if (!row) continue;
            const cols = row.split('|').map(c => c.trim());
            cols.forEach((col, i) => {
                if (colWidth[i] === undefined || col.length > colWidth[i]) {
                    colWidth[i] = col.length;
                }
            });
            rows.push(cols);
        }
        if (rows.length < 1) return PostProcessResult.RemoveNode;
        let res = '';
        const caption = nodeMetadata.get(node)!.tableMeta!.caption;
        if (caption) res += caption + '\n';
        rows.forEach((cols, rowNumber) => {
            res += '| ';
            for (let i = 0; i < colWidth.length; i++) {
                const c = cols[i] ?? '';
                res += c + ' '.repeat(colWidth[i] - c.length) + ' |'; // Pad content to match column width
            }
            res += '\n';
            if (rowNumber === 0) res += '|' + colWidth.map(w => '-'.repeat(w + 2)).join('|') + '|\n';
        });
        return res;
    },
}),
}, undefined);

function splitSpecial(s) {
  const lines = [];
  const strLen = s.length;

  for (let i = 0, startPos = 0; i < strLen; ++i) {
    const char = s.charAt(i);
    let newLineChar = '';

    if (char === '\r') newLineChar = (s.charAt(i + 1) === '\n') ? '\r\n' : char;
    else if (char === '\n') newLineChar = char;

    const endPos = newLineChar ? i :
                   i === (strLen - 1) ? i + 1 :
                   undefined;

    if (endPos === undefined) continue;

    lines.push({
      text: s.slice(startPos, endPos),
      newLineChar
    });

    startPos = endPos + newLineChar.length;
    if (newLineChar.length > 1) ++i;
  }

  return lines;
}

interface SearchResult {
  name: string;
  url: string;
  detail: string;
}
