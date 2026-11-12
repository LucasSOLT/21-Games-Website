"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, LifeBuoy, RotateCcw } from "lucide-react";

export interface PuzzleCheckRevealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the user has only entered partial letters / first word */
  isPartiallyFilled: boolean;
  /** Label for square action (defaults to "Check Square") */
  squareLabel?: string;
  /** Label for word action (defaults to "Check Word") */
  wordLabel?: string;
  /** Callbacks */
  onCheckSquare: () => void;
  onCheckWord: () => void;
  onCheckPuzzle: () => void;
  onRevealPuzzle: () => void;
  onClearPuzzle: () => void;
}

export function PuzzleCheckRevealModal({
  open,
  onOpenChange,
  isPartiallyFilled,
  squareLabel = "Check Square",
  wordLabel = "Check Word",
  onCheckSquare,
  onCheckWord,
  onCheckPuzzle,
  onRevealPuzzle,
  onClearPuzzle,
}: PuzzleCheckRevealModalProps) {
  const [view, setView] = useState<"main" | "reveal-clear">("main");
  const [confirmModal, setConfirmModal] = useState<
    null | "check-puzzle" | "reveal-puzzle" | "clear-puzzle"
  >(null);

  const handleClose = () => {
    setView("main");
    setConfirmModal(null);
    onOpenChange(false);
  };

  const handleCheckPuzzleClick = () => {
    if (isPartiallyFilled) {
      setConfirmModal("check-puzzle");
    } else {
      handleClose();
      onCheckPuzzle();
    }
  };

  return (
    <>
      {/* Primary Action Modal */}
      <Dialog
        open={open && !confirmModal}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent className="max-w-[320px] sm:max-w-xs rounded-3xl p-5 border-2 border-black/10 bg-white/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-center gap-2 pb-1">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <LifeBuoy className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <DialogTitle className="text-center font-headline text-lg sm:text-xl font-black text-black">
                {view === "main" ? "Check & Reveal" : "Reveal or Clear"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-center text-xs text-gray-500">
              {view === "main"
                ? "Verify letters or access puzzle assistance."
                : "Reveal the full solution or clear your entered letters."}
            </DialogDescription>
          </DialogHeader>

          {view === "main" ? (
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onCheckSquare();
                }}
                className="w-full py-3 px-4 rounded-full bg-neutral-200/80 hover:bg-neutral-300 font-headline font-black text-sm sm:text-base text-black transition-all active:scale-[0.98] cursor-pointer"
              >
                {squareLabel}
              </button>

              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onCheckWord();
                }}
                className="w-full py-3 px-4 rounded-full bg-neutral-200/80 hover:bg-neutral-300 font-headline font-black text-sm sm:text-base text-black transition-all active:scale-[0.98] cursor-pointer"
              >
                {wordLabel}
              </button>

              <button
                type="button"
                onClick={handleCheckPuzzleClick}
                className="w-full py-3 px-4 rounded-full bg-neutral-200/80 hover:bg-neutral-300 font-headline font-black text-sm sm:text-base text-black transition-all active:scale-[0.98] cursor-pointer"
              >
                Check Puzzle
              </button>

              <button
                type="button"
                onClick={() => setView("reveal-clear")}
                className="w-full py-3 px-4 rounded-full bg-neutral-200/80 hover:bg-neutral-300 font-headline font-black text-sm sm:text-base text-black transition-all active:scale-[0.98] cursor-pointer"
              >
                Reveal / Clear...
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full mt-1.5 py-2.5 px-4 rounded-full bg-neutral-100 hover:bg-neutral-200 font-headline font-bold text-xs sm:text-sm text-neutral-700 transition-all active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal("reveal-puzzle")}
                className="w-full py-3 px-4 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 font-headline font-black text-sm sm:text-base text-red-600 transition-all active:scale-[0.98] cursor-pointer"
              >
                Reveal Puzzle
              </button>

              <button
                type="button"
                onClick={() => setConfirmModal("clear-puzzle")}
                className="w-full py-3 px-4 rounded-full bg-neutral-200/80 hover:bg-neutral-300 font-headline font-black text-sm sm:text-base text-black transition-all active:scale-[0.98] cursor-pointer"
              >
                Clear Puzzle
              </button>

              <button
                type="button"
                onClick={() => setView("main")}
                className="w-full mt-1.5 py-2.5 px-4 rounded-full bg-neutral-100 hover:bg-neutral-200 font-headline font-bold text-xs sm:text-sm text-neutral-700 transition-all active:scale-[0.98] cursor-pointer"
              >
                Back
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Partial Fill Confirmation Dialog for "Check Puzzle" */}
      <Dialog
        open={confirmModal === "check-puzzle"}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-6 border-2 border-black/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-headline font-black text-amber-700">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              Check Entire Puzzle?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-700 pt-1 leading-relaxed">
              {"Are you sure you want to check the entire puzzle? You haven't completed all words yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="font-bold cursor-pointer"
            >
              Keep Playing
            </Button>
            <Button
              className="bg-black text-white hover:bg-gray-800 font-bold cursor-pointer"
              onClick={() => {
                handleClose();
                onCheckPuzzle();
              }}
            >
              Check Entire Puzzle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Reveal Puzzle" Confirmation Modal */}
      <Dialog
        open={confirmModal === "reveal-puzzle"}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-6 border-2 border-red-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-headline font-black text-red-600">
              <Eye className="h-5 w-5 shrink-0" />
              Reveal Entire Puzzle?
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-red-900 pt-1 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200">
              Are you sure you want to reveal the ENTIRE Puzzle? The game will end when you do!
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 font-bold cursor-pointer shadow-xs"
              onClick={() => {
                handleClose();
                onRevealPuzzle();
              }}
            >
              Reveal Puzzle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Clear Puzzle" Confirmation Modal */}
      <Dialog
        open={confirmModal === "clear-puzzle"}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-6 border-2 border-black/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-headline font-black text-gray-900">
              <RotateCcw className="h-5 w-5 text-gray-700 shrink-0" />
              Clear Puzzle?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-700 pt-1 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-200">
              Are you sure you want to clear your entered letters? This will delete all user-entered letters.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 font-bold cursor-pointer shadow-xs"
              onClick={() => {
                handleClose();
                onClearPuzzle();
              }}
            >
              Clear Puzzle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
