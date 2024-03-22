import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";
import fetch from "node-fetch"
import { NodeHtmlMarkdown, PostProcessResult } from 'node-html-markdown'
import fs from 'fs';
import path from 'path';

const markdownCache = {};
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
  // Check if Markdown content exists in the cache
  if (markdownCache[title]) {
    console.log("Retrieving Markdown content from cache for:", title);
    return markdownCache[title];
  }

  const filePath = '/tmp/stardewvalleywiki/' + title + '.md';
  // Resolve the full path including the home directory
  const resolvedFilePath = path.resolve(filePath.replace('~', process.env.HOME));

  if (!fs.existsSync(path.dirname(resolvedFilePath))) {
    fs.mkdirSync(path.dirname(resolvedFilePath), { recursive: true });
  }

  // Check if a Markdown file exists for this title
  if (fs.existsSync(resolvedFilePath)) {
    console.log("Markdown content found on disk for:", title);
    // Read Markdown content from file
    const content = fs.readFileSync(resolvedFilePath, 'utf8');
    // Store Markdown content in the cache
    markdownCache[title] = content;
    return content;
  }

  // Fetch Markdown content from the web if it's not in the cache or on disk
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

  // Replace data-sort-value attributes with empty string
  body = body.replace(/data-sort-value="(\d+)"\s*/g, '');
  body = body.replace(/<table[^>]*>/g, '<table>').replace(/<\/tr>\s*<tr[^>]*>/g, '</tr><tr>').replace(/<\/td>\s*<td[^>]*>/g, '</td><td>').replace(/<\/table>\s*<table[^>]*>/g, '</table><table>').replace(/<\/table><table><\/table>/g, '');

  console.log(body);

  const content = nhm.translate(body);

  // Store Markdown content in the cache
  markdownCache[title] = content;

  // Save markdown content to file
  fs.writeFile(resolvedFilePath, content, (err) => {
    if (err) {
      console.error('Error saving markdown to file:', err);
    } else {
      console.log('Markdown content saved to file:', resolvedFilePath);
    }
  });

  return content;
}


function splitSpecial(s: string) {
  const lines: { text: string, newLineChar: '\r' | '\n' | '\r\n' | '' }[] = [];
  const strLen = s.length;

  for (let i = 0, startPos = 0; i < strLen; ++i) {
    const char = s.charAt(i);
    let newLineChar: typeof lines[number]['newLineChar'] = '';

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

const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ {
    /* Table */
    'table': ({ visitor }) => ({
      surroundingNewlines: 2,
      childTranslators: visitor.instance.tableTranslators,
      postprocess: ({ content, nodeMetadata, node }) => {
          // Split and trim leading + trailing pipes
          const rawRows = splitSpecial(content).map(({ text }) => text.trim().replace(/^\||\|$/g, ''));
  
          /* Get Row Data */
          const rows: string[][] = [];
          const colWidth: number[] = [];
          for (const row of rawRows) {
              if (!row) continue;
  
              /* Track columns */
              const cols = row.split('|').map(c => c.trim());
  
              cols.forEach((col, i) => {
                  if (colWidth[i] === undefined || col.length > colWidth[i]) {
                      colWidth[i] = col.length;
                  }
              });
  
              rows.push(cols);
          }
  
          if (rows.length < 1) return PostProcessResult.RemoveNode;
  
          /* Compose Table */
          const maxCols = colWidth.length;
          let res = '';
  
          const caption = nodeMetadata.get(node)!.tableMeta!.caption;
          if (caption) res += caption + '\n';
  
          rows.forEach((cols, rowNumber) => {
              res += '| ';
  
              /* Add Columns */
              for (let i = 0; i < maxCols; i++) {
                  const c = cols[i] ?? '';
                  res += c.padEnd(colWidth[i]) + ' |';
              }
  
              res += '\n';
  
              // Add separator row
              if (rowNumber === 0) res += '|' + colWidth.map(w => '-'.repeat(w + 2)).join('|') + '|\n';
          });
  
          return res;
      }
  }),
  
  
  },
  /* customCodeBlockTranslators (optional) */ undefined
)

interface SearchResult {
  name: string;
  url: string;
  detail: string;
}
