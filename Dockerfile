FROM debian:latest
WORKDIR /app
VOLUME /app/package/backend/ssl/config
VOLUME /app/package/backend/config

COPY . /app/package

RUN apt-get update && apt-get install -y unzip unixodbc nodejs

RUN cd /app && mkdir package/setup_tools && mv package/setup_tools.zip package/setup_tools/setup_tools.zip && unzip package/setup_tools/setup_tools.zip -d package/setup_tools
RUN dpkg --install package/setup_tools/odbc/*.deb

RUN cp /app/package/setup_tools/odbc/sql.ini /opt/Unify/SQLBase/sql.ini
RUN cp /app/package/setup_tools/odbc/odbc.ini /etc/odbc.ini
RUN cp /app/package/setup_tools/odbc/odbcinst.ini /etc/odbcinst.ini

# Link libraries
RUN ln -s /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/libssl.so.6
RUN ln -s /lib/x86_64-linux-gnu/libodbcinst.so.2 /lib/x86_64-linux-gnu/libodbcinst.so.1

RUN echo "export NODE_ENV=deployment" >> ~/.bashrc # Set node configuration to use
RUN echo "export NODE_CONFIG_DIR=/app/package/backend/config" >> ~/.bashrc # Set node configuration to use
ENV NODE_ENV=deployment
ENV NODE_CONFIG_DIR=/app/package/backend/config

# Sleep is neccessary in order to have the VOLUME's bound correctly before starting our script.
CMD ["sh", "-c", "cd /app/package/backend && sleep 1 && node index.js"]

#-------run:
#cwd: home/runner/runner/_work/praxis_internal/praxis_internal/package:
#docker run --rm -it --volume .:/app -w /app/backend -e "NODE_ENV=deployment" node index.js