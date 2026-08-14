"""Isolated JSON-lines worker for the bundled English-to-Chinese model."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import ctranslate2
import sentencepiece as spm


def split_text(text: str, limit: int = 320) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    for sentence in sentences:
        if not sentence:
            continue
        while len(sentence) > limit:
            boundary = sentence.rfind(" ", 0, limit)
            if boundary < limit // 2:
                boundary = limit
            chunks.append(sentence[:boundary].strip())
            sentence = sentence[boundary:].strip()
        if sentence:
            chunks.append(sentence)
    return chunks


class OfflineTranslator:
    def __init__(self, package_dir: Path) -> None:
        model_dir = package_dir / "model"
        tokenizer_path = package_dir / "sentencepiece.model"
        if not (model_dir / "model.bin").is_file():
            raise FileNotFoundError(f"Missing CTranslate2 model: {model_dir}")
        if not tokenizer_path.is_file():
            raise FileNotFoundError(f"Missing SentencePiece model: {tokenizer_path}")

        self.tokenizer = spm.SentencePieceProcessor(model_file=str(tokenizer_path))
        self.translator = ctranslate2.Translator(
            str(model_dir),
            device="cpu",
            compute_type="int8",
            inter_threads=1,
            intra_threads=max(1, min(2, os.cpu_count() or 1)),
        )

    def translate(self, text: str) -> str:
        protected = re.compile(r"(__BILINGUAL_TOKEN_\d+__)")
        parts = protected.split(text)
        translated: list[str] = []
        for part in parts:
            if not part:
                continue
            if protected.fullmatch(part):
                translated.append(part)
            else:
                translated.append(self._translate_plain(part))
        return "".join(translated)

    def _translate_plain(self, text: str) -> str:
        chunks = split_text(text)
        if not chunks:
            return ""
        source = [self.tokenizer.encode(chunk, out_type=str) for chunk in chunks]
        results = self.translator.translate_batch(
            source,
            beam_size=2,
            max_batch_size=16,
            batch_type="tokens",
            replace_unknowns=True,
        )
        translated = [
            self.tokenizer.decode(result.hypotheses[0]).replace("▁", " ").strip()
            for result in results
        ]
        return "".join(translated)


def emit(message: dict[str, object]) -> None:
    print(json.dumps(message, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    args = parser.parse_args()

    try:
        translator = OfflineTranslator(args.model)
    except Exception as error:  # The host treats startup failure as isolated.
        print(f"offline model startup failed: {error}", file=sys.stderr, flush=True)
        return 2

    emit({"type": "ready"})
    for line in sys.stdin:
        request: object = {}
        try:
            request = json.loads(line)
            request_id = request["id"]
            translated = translator.translate(str(request.get("text", "")))
            emit({"id": request_id, "translated": translated})
        except Exception as error:  # One malformed request must not end the worker.
            emit({"id": request.get("id") if isinstance(request, dict) else None, "error": str(error)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
