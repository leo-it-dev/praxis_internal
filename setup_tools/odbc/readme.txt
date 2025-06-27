SQLBase for Linux 11.7.2 README

The Linux release of SQLBase 11.7.2 is provided as industry-standard RPMs.
The following RPMs are included:

SQLBase-common-11.7.2-9610.x86_64.rpm
        Common files for all SQLBase installations.

SQLBase-server-11.7.2-9610.x86_64.rpm
        The SQLBase database engine.
        This package requires SQLBase-common.

SQLBase-client-11.7.2-9610.x86_64.rpm
        SQLBase client libraries and utilities.
        This package requires SQLBase-common.

SQLBase-docs-11.7.2-9610.x86_64.rpm - Documentation

SQLBase-devel-11.7.2-9610.x86_64.rpm
        SQLBase application development libraries.
        This package requires SQLBase-common and SQLBase-client.

SQLBase-odbc-driver-11.7.2-9610.x86_64.rpm
        Linux ODBC drivers for SQLBase.
        This package requires SQLBase-common, SQLBase-client, and
        unixODBC (available on your OS installation media.)

SQLBase-jdbc-driver-11.7.2-9610.x86_64.rpm
        JDBC drivers for SQLBase.

The RPMs will install by default into /opt/Unify/SQLBase. If you wish to install
them into a different location, use the following syntax:

   rpm -i --relocate /opt/Unify/SQLBase=<new_location> <rpm_file>

For example:

   rpm -i --relocate /opt/Unify/SQLBase=/u/Unify/SQLBase SQLBase-common-11.7.2-9610.x86_64.rpm

If a previous release of SQLBase is installed on the machine, the installation
of the new SQLBase release will fail. To avoid this, first back up the database
and then to remove old release from the machine, use the following syntax:

rpm -e SQLBase-common-11.0-2 SQLBase-client-11.0-2 SQLBase-devel-11.0-2         SQLBase-docs-11.0-2 SQLBase-jdbc-driver-11.0-2 SQLBase-odbc-driver-11.0-2 
SQLBase-server-11.0-2

To install all the RPMs, use the following syntax:

rpm -ivh *.rpm
