import os
import tornado.ioloop
import tornado.web


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('main.html')


def make_app():
    return tornado.web.Application([
        (r'/', MainHandler),
        (r'/static/(.*)', tornado.web.StaticFileHandler, {'path': os.path.join(
            os.path.dirname(__file__), 'static')}),
    ], debug=True, autoreload=False, template_path=os.path.join(
        os.path.dirname(__file__), 'templates'))


def main():
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()


if __name__ == '__main__':
    main()
