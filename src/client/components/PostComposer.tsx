import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ComposerHeader } from './ComposerParts';
import SlipPicker from './SlipPicker';
import type { GroupMode, JoinTarget, PostedKind } from './GroupReview';
import useConfirm from './ConfirmDialog';
import type { FeedPost } from '../../shared/posts';

// Every slip is built from live odds, so picks, prices and add-to-betslip
// links are always the book's own.

/**
 * The live-odds picker. A header switch turns it into "start a group
 * parlay"; `join` opens it straight into adding your leg to one.
 */
function Composer({
  onClose,
  onPosted,
  dirtyRef,
  join,
  edit,
  onSaved,
}: {
  onClose: () => void;
  onPosted: (kind: PostedKind) => void;
  dirtyRef: React.MutableRefObject<boolean>;
  join: JoinTarget | null;
  edit: FeedPost | null;
  onSaved?: (post: FeedPost) => void;
}) {
  const { isSubscribed } = useAuth();
  const [startingGroup, setStartingGroup] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  /** Changing what's being built clears the slip, so check first */
  const confirmClear = async (title: string) =>
    !dirtyRef.current ||
    confirm({
      title,
      message: 'Your current slip will be cleared.',
      confirmLabel: 'Switch',
      cancelLabel: 'Keep it',
    });

  const toggleGroup = async () => {
    const ok = await confirmClear(
      startingGroup ? 'Back to a regular slip?' : 'Start a group parlay?'
    );
    if (!ok) return;
    // eslint-disable-next-line no-param-reassign
    dirtyRef.current = false;
    setStartingGroup((g) => !g);
  };

  let group: GroupMode | null = null;
  if (join) group = { kind: 'join', ...join };
  else if (startingGroup) group = { kind: 'start' };

  let title = 'New slip';
  if (edit) title = 'Edit slip';
  else if (group?.kind === 'join') title = 'Add your leg';
  else if (group) title = 'New group parlay';

  if (!isSubscribed) {
    return (
      <>
        <ComposerHeader title={title} onClose={onClose} />
        <div className="px-5 py-10 text-center">
          <h3 className="text-xl font-bold">Posting is for subscribers</h3>
          <p className="mt-2 text-gray-400">
            A $5/month subscription covers live odds and lets you post slips and
            add group parlay legs. Free accounts can still view, tail and place
            group parlays.
          </p>
          <Link
            to="/billing"
            onClick={onClose}
            className="mt-6 inline-block rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400"
          >
            Subscribe
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SlipPicker
        // Fresh picker state when switching between a slip and a group leg
        key={group?.kind ?? 'slip'}
        header={
          <ComposerHeader title={title} onClose={onClose}>
            {!join && !edit && (
              <button
                type="button"
                onClick={toggleGroup}
                aria-pressed={startingGroup}
                className="rounded-lg px-2 py-1 text-sm font-medium text-emerald-400 transition hover:bg-gray-800"
              >
                {startingGroup ? 'Regular slip' : '👥 Group parlay'}
              </button>
            )}
          </ComposerHeader>
        }
        onPosted={onPosted}
        dirtyRef={dirtyRef}
        group={group}
        edit={edit}
        onSaved={onSaved}
      />
      {confirmDialog}
    </>
  );
}

/**
 * The slip builder as a modal. Full-screen on phones, a centered panel from
 * `sm` up. The form only mounts while open, so each open starts a fresh slip.
 */
export default function PostComposer({
  open,
  onClose,
  onPosted,
  join = null,
  edit = null,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: (kind: PostedKind) => void;
  /** Open as "add your leg" to this group parlay */
  join?: JoinTarget | null;
  /** Open on this posted straight / parlay to change it */
  edit?: FeedPost | null;
  onSaved?: (post: FeedPost) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dirtyRef = useRef(false);
  const [confirm, confirmDialog] = useConfirm();

  // Every close path (✕, Escape) goes through here
  const requestClose = async () => {
    if (
      dirtyRef.current &&
      !(await confirm({
        title: edit ? 'Discard your changes?' : 'Discard this slip?',
        message: edit
          ? 'The slip stays as it was.'
          : 'Your picks will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      }))
    )
      return;
    onClose();
  };

  useEffect(() => {
    if (open) dirtyRef.current = false;
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (!open) {
      if (dialog.open) dialog.close();
      return undefined;
    }
    dialog.showModal();
    // showModal doesn't stop the page behind it from scrolling
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={(edit && 'Edit slip') || (join ? 'Add your leg' : 'New slip')}
      // Escape fires `cancel`; let React state drive the close instead
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      className="m-0 h-full max-h-full w-full max-w-full bg-gray-950 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm open:flex open:flex-col sm:m-auto sm:h-[88vh] sm:p-0 sm:max-h-[56rem] sm:max-w-xl sm:rounded-2xl sm:border sm:border-gray-800 sm:shadow-2xl"
    >
      {open && (
        <Composer
          onClose={requestClose}
          onPosted={onPosted}
          dirtyRef={dirtyRef}
          join={join}
          edit={edit}
          onSaved={onSaved}
        />
      )}
      {confirmDialog}
    </dialog>
  );
}
