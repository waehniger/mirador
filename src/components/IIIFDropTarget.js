import React from 'react';
import PropTypes from 'prop-types';
import { v4 as uuid } from 'uuid';
import { NativeTypes } from 'react-dnd-html5-backend';
import { useDrop } from 'react-dnd';

/** */
export const IIIFDropTarget = (props) => {
  const { children, onDrop } = props;
  const [{ canDrop, isOver }, drop] = useDrop({
    accept: [NativeTypes.URL, NativeTypes.FILE],
    collect: monitor => ({
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver(),
    }),
    /** */
    drop(item, monitor) {
      if (!onDrop) return;

      if (item.urls) {
        item.urls.forEach((str) => {
          const url = new URL(str);
          const manifestId = url.searchParams.get('manifest');
          const canvasId = url.searchParams.get('canvas');

          if (manifestId) onDrop({ canvasId, manifestId }, props, monitor);
        });
      }

      if (item.files) {
        item.files.filter(f => f.type === 'application/json').forEach((file) => {
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            const manifestJson = reader.result;

            if (manifestJson) onDrop({ manifestJson }, props, monitor);
          });
          reader.readAsText(file);
        });

        const imageFiles = item.files.filter(({ type }) => type.startsWith('image/'));

        if (imageFiles.length > 0) {
          const id = uuid();
          const imageData = imageFiles.map(file => (
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.addEventListener('load', () => {
                const image = new Image();
                image.src = reader.result;
                image.addEventListener('load', () => {
                  resolve({
                    height: image.height,
                    name: file.name,
                    type: file.type,
                    url: reader.result,
                    width: image.width,
                  });
                });
              });
              reader.readAsDataURL(file);
            })
          ));

          Promise.all(imageData).then((images) => {
            const manifestJson = {
              '@context': 'http://iiif.io/api/presentation/3/context.json',
              id,
              items: images.map(({
                name, type, width, height, url,
              }, index) => ({
                height,
                id: `${id}/canvas/${index}`,
                items: [
                  {
                    id: `${id}/canvas/${index}/1`,
                    items: [{
                      body: {
                        format: type,
                        id: url,
                        type: 'Image',
                      },
                      height,
                      id: `${id}/canvas/${index}/1/image`,
                      motivation: 'painting',
                      target: `${id}/canvas/${index}/1`,
                      type: 'Annotation',
                      width,
                    }],
                    type: 'AnnotationPage',
                  },
                ],
                label: name,
                type: 'Canvas',
                width,
              })),
              label: images[0].name,
              type: 'Manifest',
            };

            if (manifestJson) onDrop({ manifestJson }, props, monitor);
          });
        }
      }
    },
  });
  // TODO: give some indication the app receives drops
  const isActive = canDrop && isOver; // eslint-disable-line no-unused-vars

  return (
    <div ref={drop}>
      {children}
    </div>
  );
};

IIIFDropTarget.propTypes = {
  children: PropTypes.node.isRequired,
  onDrop: PropTypes.func.isRequired,
};
