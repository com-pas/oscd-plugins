import { MdOutlinedField } from '@scopedelement/material-web/field/MdOutlinedField.js';

/** What Material passes into its private label animation. */
type LabelAnimationState = {
  wasFocused?: boolean;
  wasPopulated?: boolean;
};

/**
 * A closed `md-dialog` is `display: none`, so both label widths are 0.
 * Material animates `scale(0 / 0)` and Chrome logs an invalid keyframe.
 * Skip that animation until the labels have a box. The populated class
 * still updates, so the label is already floating when the dialog opens.
 *
 * Upstream fix: material-web#5815, PR #5860, released in `@material/web` 2.4.2.
 * `@scopedelement/material-web` 3.10.0 does not include that release.
 */
export class MeasuredOutlinedField extends MdOutlinedField {}

const measuredFieldLabelAnimation = Object.getPrototypeOf(
  MeasuredOutlinedField.prototype,
) as {
  animateLabelIfNeeded(this: MdOutlinedField, state: LabelAnimationState): void;
};

Object.assign(MeasuredOutlinedField.prototype, {
  animateLabelIfNeeded(
    this: MeasuredOutlinedField,
    state: LabelAnimationState,
  ): void {
    const floating = this.renderRoot.querySelector('.label.floating');
    const resting = this.renderRoot.querySelector('.label.resting');
    if (
      !(floating instanceof HTMLElement) ||
      !(resting instanceof HTMLElement) ||
      floating.scrollWidth === 0 ||
      resting.scrollWidth === 0
    ) {
      return;
    }
    measuredFieldLabelAnimation.animateLabelIfNeeded.call(this, state);
  },
});
