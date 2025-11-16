'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faStar, faLightbulb, faRotateRight } from '@fortawesome/free-solid-svg-icons';

interface PuzzlePiece {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

interface Combination {
  pieces: string[];
  result: PuzzlePiece;
  explanation: string;
}

interface DragDropSandboxData {
  type: 'drag-drop';
  mode: 'build' | 'breakdown';
  title: string;
  description: string;
  startingPieces?: PuzzlePiece[];
  targetPiece?: PuzzlePiece;
  combinations?: Combination[];
  breakdownLevels?: PuzzlePiece[][];
  kidFriendlyExplanation: string;
  celebrationMessage: string;
}

interface Props {
  data: DragDropSandboxData;
}

// Draggable piece component
function DraggablePiece({ piece, isActive, isDraggable = true, uniqueKey }: { 
  piece: PuzzlePiece; 
  isActive?: boolean; 
  isDraggable?: boolean;
  uniqueKey?: string;
}) {
  const dragId = uniqueKey || piece.id;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragId,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isActive ? 'none' : 'transform 0.2s ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      className={`
        relative ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        rounded-2xl p-4 min-w-[140px] max-w-[200px]
        bg-white/10 border border-white/20
        shadow-lg hover:shadow-xl
        transition-all duration-200
        ${isActive ? 'scale-110 z-50 bg-white/20' : isDraggable ? 'hover:scale-105 hover:bg-white/15' : ''}
      `}
      title={piece.description}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-10"
        style={{ backgroundColor: piece.color }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <div className="text-5xl">{piece.emoji}</div>
        <div className="text-sm font-semibold text-white">{piece.label}</div>
        <div className="text-xs text-white/60 line-clamp-2">{piece.description}</div>
      </div>
    </div>
  );
}

// Drop zone for combining pieces
function DropZone({ id, children, label }: { id: string; children: React.ReactNode; label: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative min-h-[250px] rounded-3xl p-6
        border-4 border-dashed transition-all duration-300
        ${isOver 
          ? 'border-purple-500 bg-purple-900/20 scale-105' 
          : 'border-white/20 bg-white/5'
        }
      `}
    >
      <div className="absolute top-4 left-4 text-sm font-medium text-white/60">
        {label}
      </div>
      <div className="flex flex-wrap gap-3 justify-center items-center min-h-[180px] mt-8">
        {children}
      </div>
    </div>
  );
}

export default function DragDropSandbox({ data }: Props) {
  const [activePiece, setActivePiece] = useState<PuzzlePiece | null>(null);
  const [inventory, setInventory] = useState<PuzzlePiece[]>([]);
  const [combineZone, setCombineZone] = useState<PuzzlePiece[]>([]);
  const [created, setCreated] = useState<PuzzlePiece[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastExplanation, setLastExplanation] = useState('');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pieceKeyCounter, setPieceKeyCounter] = useState(0);
  const [detailView, setDetailView] = useState<PuzzlePiece | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Initialize based on mode with validation
  useEffect(() => {
    if (!data) {
      console.error('DragDropSandbox: No data provided');
      return;
    }
    
    if (data.mode === 'build') {
      if (!data.startingPieces || data.startingPieces.length === 0) {
        console.error('DragDropSandbox: Build mode requires startingPieces');
        return;
      }
      setInventory([...data.startingPieces]);
    } else if (data.mode === 'breakdown') {
      if (!data.targetPiece) {
        console.error('DragDropSandbox: Breakdown mode requires targetPiece');
        return;
      }
      setInventory([data.targetPiece]);
    }
    
    setIsInitialized(true);
  }, [data]);
  
  // Show loading state if not initialized
  if (!isInitialized) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/60 font-medium">Loading interactive sandbox...</p>
        </div>
      </div>
    );
  }

  function handleDragStart(event: any) {
    const dragId = event.active.id as string;
    // Find piece by unique key
    let piece: PuzzlePiece | undefined;
    
    const invPiece = inventory.find((p, idx) => `inv-${idx}-${p.id}` === dragId);
    const combPiece = combineZone.find((p, idx) => `comb-${idx}-${p.id}` === dragId);
    
    piece = invPiece || combPiece;
    setActivePiece(piece || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePiece(null);
    const { active, over } = event;

    if (!over) return;

    const dragId = active.id as string;
    
    // Find piece by matching the unique key or base ID
    let piece: PuzzlePiece | undefined;
    let fromZone: 'inventory' | 'combine' | null = null;
    
    const invIndex = inventory.findIndex((p, idx) => `inv-${idx}-${p.id}` === dragId || p.id === dragId);
    if (invIndex >= 0) {
      piece = inventory[invIndex];
      fromZone = 'inventory';
    } else {
      const combIndex = combineZone.findIndex((p, idx) => `comb-${idx}-${p.id}` === dragId || p.id === dragId);
      if (combIndex >= 0) {
        piece = combineZone[combIndex];
        fromZone = 'combine';
      }
    }

    if (!piece || !fromZone) return;

    // Moving from inventory to combine zone
    if (fromZone === 'inventory' && over.id === 'combine-zone') {
      setInventory(prev => prev.filter((_, idx) => `inv-${idx}-${prev[idx].id}` !== dragId));
      setCombineZone(prev => [...prev, piece!]);
      setTimeout(() => checkCombination([...combineZone, piece!]), 100);
    }
    
    // Moving from combine zone back to inventory
    else if (fromZone === 'combine' && over.id === 'inventory-zone') {
      setCombineZone(prev => prev.filter((_, idx) => `comb-${idx}-${prev[idx].id}` !== dragId));
      setInventory(prev => [...prev, piece!]);
    }
  }

  function checkCombination(piecesInZone: PuzzlePiece[]) {
    if (!data.combinations || piecesInZone.length < 2) return;

    const pieceIds = piecesInZone.map(p => p.id).sort();

    // Check all combinations
    for (const combo of data.combinations) {
      const comboIds = [...combo.pieces].sort();
      
      // Check if this combination matches
      if (comboIds.length === pieceIds.length && 
          comboIds.every((id, i) => id === pieceIds[i])) {
        
        // SUCCESS! Create new piece
        setTimeout(() => {
          setCombineZone([]);
          const newPiece = combo.result;
          setCreated(prev => [...prev, newPiece]);
          // Also add result to inventory so it can be used in further combinations
          setInventory(prev => [...prev, newPiece]);
          setLastExplanation(combo.explanation);
          
          // Show celebration
          setShowCelebration(true);

          // Check if completed all combinations
          const allResults = data.combinations!.map(c => c.result.id);
          const createdIds = [...created.map(p => p.id), newPiece.id];
          const finalResult = allResults[allResults.length - 1];
          
          if (createdIds.includes(finalResult)) {
            // Final celebration!
            setTimeout(() => {
              setShowCelebration(true);
              setLastExplanation(data.celebrationMessage);
            }, 500);
          }
        }, 300);
        
        return;
      }
    }
    
    // No valid combination - give feedback if zone is full
    if (piecesInZone.length >= 2) {
      setLastExplanation("Hmm, these pieces don't combine. Try different ones!");
    }
  }

  function handleBreakdown(piece: PuzzlePiece) {
    if (data.mode !== 'breakdown' || !data.breakdownLevels) return;

    const nextLevel = currentLevel + 1;
    if (nextLevel >= data.breakdownLevels.length) {
      // All levels explored!
      setShowCelebration(true);
      setLastExplanation(data.celebrationMessage);
      return;
    }

    // Remove clicked piece and add next level pieces
    setInventory(prev => {
      const filtered = prev.filter(p => p.id !== piece.id);
      return [...filtered, ...data.breakdownLevels![nextLevel]];
    });
    
    setCurrentLevel(nextLevel);
    setLastExplanation(`Breaking down into smaller parts!`);
  }
  
  function handleDeconstruct(resultPiece: PuzzlePiece) {
    if (!data.combinations) return;
    
    // Find the combination that created this result
    const combination = data.combinations.find(c => c.result.id === resultPiece.id);
    if (!combination) return;
    
    // Remove from created items
    setCreated(prev => prev.filter(p => p.id !== resultPiece.id));
    
    // Remove from inventory (in case it was added there)
    setInventory(prev => prev.filter(p => p.id !== resultPiece.id));
    
    // Remove from combine zone (in case it was dragged there)
    setCombineZone(prev => prev.filter(p => p.id !== resultPiece.id));
    
    // Return the original pieces to inventory
    const originalPieces = combination.pieces
      .map(pieceId => {
        // Check if it's in starting pieces
        const startingPiece = data.startingPieces?.find(p => p.id === pieceId);
        if (startingPiece) return startingPiece;
        
        // Check if it's a result from another combination
        const resultPiece = data.combinations?.find(c => c.result.id === pieceId)?.result;
        return resultPiece;
      })
      .filter((p): p is PuzzlePiece => p !== undefined);
    
    setInventory(prev => [...prev, ...originalPieces]);
    setLastExplanation(`🔧 Deconstructed ${resultPiece.label} back into its components!`);
  }
  
  function deconstructPiece(createdPiece: PuzzlePiece) {
    if (!data.combinations) return;
    
    // Find the combination that created this piece
    const combination = data.combinations.find(c => c.result.id === createdPiece.id);
    if (!combination) return;
    
    // Remove from created list
    setCreated(prev => prev.filter(p => p.id !== createdPiece.id));
    
    // Remove from inventory if it's there
    setInventory(prev => prev.filter(p => p.id !== createdPiece.id));
    
    // Remove from combine zone if it's there
    setCombineZone(prev => prev.filter(p => p.id !== createdPiece.id));
    
    // Add the original pieces back to inventory (only if they don't already exist)
    const originalPieces = combination.pieces.map(pieceId => {
      // Find the piece in starting pieces or other created pieces
      return data.startingPieces?.find(p => p.id === pieceId) ||
             created.find(p => p.id === pieceId) ||
             inventory.find(p => p.id === pieceId);
    }).filter(Boolean) as PuzzlePiece[];
    
    setInventory(prev => [...prev, ...originalPieces]);
    setLastExplanation(`🔧 Deconstructed back into ${originalPieces.length} pieces!`);
  }

  function resetSandbox() {
    if (data.mode === 'build' && data.startingPieces) {
      setInventory([...data.startingPieces]);
    } else if (data.mode === 'breakdown' && data.targetPiece) {
      setInventory([data.targetPiece]);
    }
    setCombineZone([]);
    setCreated([]);
    setCurrentLevel(0);
    setLastExplanation('');
    setShowCelebration(false);
    setActivePiece(null);
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 bg-black overflow-y-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">{data.title}</h2>
        <p className="text-lg text-white/70">{data.description}</p>
      </div>

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-2xl p-8 shadow-2xl max-w-md mx-4 relative">
            <button
              onClick={() => setShowCelebration(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-2xl font-bold text-center text-white mt-2">{lastExplanation}</div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {data.mode === 'build' ? (
          <>
            {/* Combine Zone */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">
                🔬 Experiment Area
              </h3>
              <DropZone id="combine-zone" label="🎯 Drag pieces here to combine!">
                {combineZone.length === 0 ? (
                  <p className="text-white/40 text-sm">Drag pieces from below to experiment!</p>
                ) : (
                  combineZone.map((piece, idx) => (
                    <DraggablePiece 
                      key={`comb-${idx}-${piece.id}`}
                      uniqueKey={`comb-${idx}-${piece.id}`}
                      piece={piece} 
                    />
                  ))
                )}
              </DropZone>
            </div>

            {/* Inventory */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide flex items-center gap-2">
                <FontAwesomeIcon icon={faBox} className="text-purple-400" />
                Available Pieces
              </h3>
              <DropZone id="inventory-zone" label="↩️ Drag pieces back here to remove them">
                {inventory.length === 0 ? (
                  <p className="text-white/40 text-sm">All pieces are in use!</p>
                ) : (
                  inventory.map((piece, idx) => (
                    <div
                      key={`inv-${idx}-${piece.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailView(piece);
                      }}
                      className="cursor-pointer"
                    >
                      <DraggablePiece 
                        uniqueKey={`inv-${idx}-${piece.id}`}
                        piece={piece} 
                      />
                    </div>
                  ))
                )}
              </DropZone>
            </div>

            {/* Created pieces */}
            {created.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <FontAwesomeIcon icon={faStar} className="text-green-400" />
                  What You Created!
                </h3>
                <div className="flex flex-wrap gap-3">
                  {created.map((piece, idx) => (
                    <div 
                      key={`created-${idx}-${piece.id}`} 
                      className="relative cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => deconstructPiece(piece)}
                      title="Click to break down into parts"
                    >
                      <DraggablePiece 
                        piece={piece} 
                        isDraggable={false}
                        uniqueKey={`created-${idx}-${piece.id}`}
                      />
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">
                        ✓
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/50 mt-2 italic">
                  <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" /> Click any created item to break it back down into its parts
                </p>
              </div>
            )}
          </>
        ) : (
          /* Breakdown Mode */
          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">
              Click pieces to explore inside!
            </h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {inventory.map(piece => (
                <button
                  key={piece.id}
                  onClick={() => handleBreakdown(piece)}
                  className="transform transition-all hover:scale-110 focus:scale-110"
                >
                  <DraggablePiece piece={piece} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activePiece ? <DraggablePiece piece={activePiece} isActive /> : null}
        </DragOverlay>
      </DndContext>

      {/* Explanation */}
      {lastExplanation && !showCelebration && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="text-3xl flex-shrink-0 text-purple-400">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium leading-relaxed">{lastExplanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Kid-friendly explanation */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-md">
        <h4 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wide flex items-center gap-2">
          <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" />
          What You're Learning
        </h4>
        <p className="text-white/80 leading-relaxed">{data.kidFriendlyExplanation}</p>
      </div>

      {/* Reset button */}
      <button
        onClick={resetSandbox}
        className="self-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors shadow-lg flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faRotateRight} />
        Start Over
      </button>

      {/* Detail View Modal */}
      {detailView && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDetailView(null)}
        >
          <div 
            className="relative max-w-md w-full rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ backgroundColor: detailView.color }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Back button */}
            <button
              onClick={() => setDetailView(null)}
              className="absolute top-4 left-4 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all z-10"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Content */}
            <div className="p-8 pt-16 text-white">
              {/* Emoji */}
              <div className="text-8xl mb-6 text-center drop-shadow-lg">
                {detailView.emoji}
              </div>

              {/* Label */}
              <h3 className="text-3xl font-bold mb-4 text-center drop-shadow-md">
                {detailView.label}
              </h3>

              {/* Description */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-lg leading-relaxed font-medium">
                  {detailView.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
