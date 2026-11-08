"""Operators package for AIVideo-Studio.

Imports all operator modules so they register themselves into OperatorRegistry.
"""

from operators.avatar_operator import AvatarOperator
from operators.image_motion_operator import ImageMotionOperator
from operators.motion_text_operator import MotionTextOperator
from operators.script_operator import ScriptOperator
from operators.smart_editor_operator import SmartEditorOperator
from operators.video_composer_operator import VideoComposerOperator
from operators.voice_operator import VoiceOperator

__all__ = [
    "ScriptOperator",
    "VoiceOperator",
    "ImageMotionOperator",
    "SmartEditorOperator",
    "MotionTextOperator",
    "AvatarOperator",
    "VideoComposerOperator",
]
