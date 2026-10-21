import { Router } from 'express';
import prisma from '../db';
import { reactionSummary } from '../feed';
import { requireAuth } from '../middleware/auth';
import {
  commentSchema,
  FeedComment,
  isReactionEmoji,
  Tailer,
  Vote,
  voteSchema,
} from '../../shared/social';

// Tailers, reactions and comments on a slip. Free users can do all of it.

const router = Router();

const personSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} as const;

const livePost = (id: string) =>
  prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

/** Who tailed a slip, most recent first (once per person, even on ladders) */
router.get<{ postId: string }>(
  '/posts/:postId/tails',
  requireAuth,
  async (req, res) => {
    if (!(await livePost(req.params.postId))) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const tails = await prisma.tail.findMany({
      where: { bet: { postId: req.params.postId } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, user: { select: personSelect } },
    });
    const byUser = new Map<string, Tailer>();
    tails.forEach((t) => {
      if (!byUser.has(t.user.id)) {
        byUser.set(t.user.id, {
          ...t.user,
          tailedAt: t.createdAt.toISOString(),
        });
      }
    });
    res.json([...byUser.values()].reverse());
  }
);

/** Toggle one of the viewer's reactions; returns the slip's new totals */
router.post<{ postId: string }>(
  '/posts/:postId/reactions',
  requireAuth,
  async (req, res) => {
    const emoji = req.body?.emoji;
    if (!isReactionEmoji(emoji)) {
      res.status(400).json({ error: 'Unknown reaction' });
      return;
    }
    const { postId } = req.params;
    if (!(await livePost(postId))) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const key = { postId, userId: req.user!.id, emoji };
    const { count } = await prisma.reaction.deleteMany({ where: key });
    if (!count) {
      await prisma.reaction.createMany({ data: [key], skipDuplicates: true });
    }
    const rows = await prisma.reaction.findMany({
      where: { postId },
      select: { emoji: true, userId: true },
    });
    res.json(reactionSummary(rows, req.user!.id));
  }
);

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: personSelect },
  votes: { select: { userId: true, value: true } },
} as const;

function toComment(
  c: {
    id: string;
    body: string;
    createdAt: Date;
    author: FeedComment['author'];
    votes: { userId: string; value: number }[];
  },
  viewerId: string
): FeedComment {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: c.author,
    likes: c.votes.filter((v) => v.value > 0).length,
    dislikes: c.votes.filter((v) => v.value < 0).length,
    myVote: (c.votes.find((v) => v.userId === viewerId)?.value ?? 0) as Vote,
  };
}

/** A slip's comments, oldest first */
router.get<{ postId: string }>(
  '/posts/:postId/comments',
  requireAuth,
  async (req, res) => {
    if (!(await livePost(req.params.postId))) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const viewerId = req.user!.id;
    const comments = await prisma.comment.findMany({
      where: { postId: req.params.postId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: commentSelect,
    });
    res.json(comments.map((c) => toComment(c, viewerId)));
  }
);

router.post<{ postId: string }>(
  '/posts/:postId/comments',
  requireAuth,
  async (req, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid comment' });
      return;
    }
    if (!(await livePost(req.params.postId))) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const viewerId = req.user!.id;
    const comment = await prisma.comment.create({
      data: {
        postId: req.params.postId,
        authorId: viewerId,
        body: parsed.data.body,
      },
      select: commentSelect,
    });
    res.status(201).json(toComment(comment, viewerId));
  }
);

/** Delete your own comment (admins can delete any) */
router.delete<{ commentId: string }>(
  '/comments/:commentId',
  requireAuth,
  async (req, res) => {
    const { count } = await prisma.comment.updateMany({
      where: {
        id: req.params.commentId,
        deletedAt: null,
        ...(!req.user!.isAdmin && { authorId: req.user!.id }),
      },
      data: { deletedAt: new Date() },
    });
    if (!count) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    res.status(204).end();
  }
);

/** Like (1), dislike (-1) or clear (0) a comment */
router.put<{ commentId: string }>(
  '/comments/:commentId/vote',
  requireAuth,
  async (req, res) => {
    const parsed = voteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid vote' });
      return;
    }
    const { commentId } = req.params;
    const userId = req.user!.id;
    const exists = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null, post: { deletedAt: null } },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    const { value } = parsed.data;
    if (value === 0) {
      await prisma.commentVote.deleteMany({ where: { commentId, userId } });
    } else {
      await prisma.commentVote.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId, value },
        update: { value },
      });
    }
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
      select: commentSelect,
    });
    res.json(toComment(comment, userId));
  }
);

export default router;
