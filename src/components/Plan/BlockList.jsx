// src/components/Plan/BlockList.jsx
// DROP IN: replace existing BlockList.jsx
// Zero logic changes — identical to original.

import BlockCard from "./BlockCard";

export default function BlockList({
    blocks,
    busy,
    onStart,
    onPause,
    onResume,
    onStop,
}) {
    if (!blocks || !blocks.length) {
        return <div className="plan-card">No study blocks yet</div>;
    }

    return (
        <div className="blocks-grid">
            {blocks.map((block) => (
                <BlockCard
                    key={block.BlockId}
                    block={block}
                    busy={busy}
                    onStart={onStart}
                    onPause={onPause}
                    onResume={onResume}
                    onStop={onStop}
                />
            ))}
        </div>
    );
}
