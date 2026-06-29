export const STORY_OPEN_CREATE_EVENT = 'instacollab:open-story-create';

export type StoryOpenCreateDetail = {
  /** Skip the “no stories yet” intro and open camera/gallery immediately */
  skipEmpty?: boolean;
  /** After publishing, open the story viewer at this segment index */
  viewSegmentIndex?: number;
};

export function dispatchOpenStoryCreate(detail?: StoryOpenCreateDetail) {
  window.dispatchEvent(
    new CustomEvent<StoryOpenCreateDetail>(STORY_OPEN_CREATE_EVENT, { detail })
  );
}
