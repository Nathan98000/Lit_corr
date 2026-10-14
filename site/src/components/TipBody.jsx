import { Fragment } from "react";
import { upperFirst } from "../lib/wording.js";
import "../tips.css";

/**
 * A chart card's title and numbers, as the Genres page's and the Trends page's cards have them (tips.css): the title
 * (a genre, a period) with its stories at the right, then each block of [label, value] pairs from a new line, under
 * its caption when it has one, whose line breaks only between its parts ("Among stories with any" and "(per 1,000
 * words)"); `line` when there are no numbers ("Fewer than 10 stories."). `order` gives a block's pairs in the order the
 * card's grid places them (gridOrder on the Genres page, whose grid holds two pairs to a line); each page's CSS sets
 * its grid's columns.
 */
export default function TipBody({ title, details, order = (block) => block.items }) {
  return (
    <>
      <p className="tip-head">
        <strong>{title}</strong>
        {details.stories && <span>{details.stories}</span>}
      </p>
      {details.blocks.length ? (
        <div className="tip-numbers">
          {details.blocks.map((b, i) => (
            <Fragment key={i}>
              {b.caption && (
                <p className="tip-caption">
                  {b.caption.map((part, k) => (
                    <Fragment key={k}>
                      {k > 0 && " "}
                      <span>{part}</span>
                    </Fragment>
                  ))}
                </p>
              )}
              {b.items.length > 0 && (
                <dl>
                  {order(b).map(([k, v]) => (
                    <div key={k} className="tip-item">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Fragment>
          ))}
        </div>
      ) : (
        <p>{upperFirst(details.line)}</p>
      )}
    </>
  );
}
