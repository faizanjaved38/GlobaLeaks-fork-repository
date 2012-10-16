# -*- coding: UTF-8
#   tip
#   ***
#   :copyright: 2012 Hermes No Profit Association - GlobaLeaks Project
#   :author: Claudio Agosti <vecna@globaleaks.org>, Arturo Filastò <art@globaleaks.org>
#   :license: see LICENSE
#
#   Contains all the logic for handling tip related operations.

from twisted.internet.defer import inlineCallbacks
from cyclone.web import asynchronous, HTTPError

from globaleaks.handlers.base import BaseHandler
from globaleaks.models.tip import Tip
import json

class TipRoot(BaseHandler):

    @asynchronous
    @inlineCallbacks
    def get(self, receipt):
        print "Processing %s" % receipt
        tip = Tip()

        tip_dict = yield tip.lookup(receipt)

        self.write(tip_dict)
        self.finish()


    """
    root of /tip/ POST handle *deleting* and *forwarding* options,
    they are checked in the tip-properties
    (assigned by the tip propetary), only the receiver may have
    this properties
    """
    def post(self, tip_id, *arg, **kw):
        pass

class TipComment(BaseHandler):

    @asynchronous
    @inlineCallbacks
    def post(self, receipt):

        print "New comment in %s" % receipt
        request = json.loads(self.request.body)

        if 'comment' in request and request['comment']:
            tip = Tip()
            yield tip.add_comment(receipt, request['comment'])

            self.set_status(200)
        else:
            self.set_status(404)

        self.finish()

class TipFiles(BaseHandler):
    """
    files CURD at the moment is not yet finished
    along with the javascript part.
    """
    def get(self, *arg, **kw):
        pass

    def put(self, *arg, **kw):
        pass

    def post(self, *arg, **kw):
        pass

    def delete(self, *arg, **kw):
        pass

class TipFinalize(BaseHandler):
    def post(self, *arg, **kw):
        pass


class TipDownload(BaseHandler):
    """
    Receiver only - enabled only if local delivery is set
    """
    def get(self, *arg, **kw):
        pass

class TipPertinence(BaseHandler):
    """
    pertinence is marked as GET, but need to be a POST,
    either because a receiver may express +1 -1 values,
    and because can be extended in the future
    """
    def post(self, *arg, **kw):
        pass

